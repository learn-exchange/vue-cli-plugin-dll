const path = require('path');
const {
  baseDllPath,
  log,
  isInstallOf,
  forEachObj,
  isFunctionAndCall
} = require('./service/helper');

const Dll = require('./service/dll.js');

module.exports = (api, options) => {
  const webpack = require('webpack');
  const dllConfig = (options.pluginOptions && options.pluginOptions.dll) || {};
  const dll = new Dll(api.resolveWebpackConfig(), dllConfig);

  api.chainWebpack(config => {
    if (!dll.isOpen || dll.isCommand === true) return;

    const referenceArgs = dll.resolveDllReferenceArgs();

    config.when(referenceArgs.length !== 0, config => {
      // add DllReferencePlugins
      referenceArgs.forEach(args => {
        config
          .plugin(`dll-reference-${args.manifest.name}`)
          .use(webpack.DllReferencePlugin, [args]);
      });

      // auto inject
      if (dll.inject) {
        config
          .plugin('dll-add-asset-html')
          .use(
            require('add-asset-html-webpack-plugin'),
            dll.resolveAddAssetHtmlArgs()
          );
        // add copy agrs
        config.plugin('copy').tap(args => {
          // 解析最后一部分
          const lastPath = path.basename(dll.outputPath);
          // console.log('lastPath' + lastPath);
          args[0][0].ignore.push(`${lastPath}/**`);
          args[0][0].ignore.push(`${lastPath}/*.manifest.json`);
          args[0].push({
            from: dll.outputPath,
            toType: 'dir',
            ignore: ['*.js', '*.css', '*.manifest.json']
          });
          // console.log('args', args, args[0]);
          // console.log('args', path.dirname(dll.outputPath));
          // console.log(process.cwd(), dll.outputPath);
          // console.log(path.relative(process.cwd(), dll.outputPath));
          return args;
        });
        // console.log(config);
      }
    });
  });

  api.registerCommand(
    'dll',
    {
      description: 'build dll',
      usage: 'vue-cli-service dll',
      options: {}
    },
    async function (args) {
      dll.callCommand();

      // entry parameter can not be empty
      if (!dll.validateEntry()) {
        throw Error('"entry" parameter no found, more config url:');
      }

      const FileNameCachePlugin = require('./service/fileNameCachePlugin');

      api.chainWebpack(config => {
        const extractOptions = Object.assign({
          filename: `${baseDllPath}/css/[name].[contenthash:8].css`,
          chunkFilename: `${baseDllPath}/css/[name].[contenthash:8].css`
        }, {});

        config
          .plugin('dll')
          .use(webpack.DllPlugin, dll.resolveDllArgs())
          .end()
          .plugin('file-list-plugin')
          .use(FileNameCachePlugin);

        config.optimization.delete('splitChunks');
        config.optimization.delete('runtimeChunk');
        config.devtool(false);
        // console.log('config', config);
        // fonts images media
        const staticRes = ['fonts', 'images', 'media'];
        staticRes.forEach((type) => genUrlLoaderOptions(type));

        function genUrlLoaderOptions(type) {
          config.module
            .rule(type)
            .use('url-loader')
            .loader('url-loader')
            .tap((options) => {
              // options.fallback loader -> file-loader
              options.fallback.options['name'] = `${baseDllPath}/${type === 'images' ? 'img' : type}/[name].[hash:8].[ext]`;
              return options;
            })
            .end();
        }

        // svg
        config.module
          .rule('svg')
          .use('file-loader')
          .loader('file-loader')
          .tap((options) => {
            options['name'] = `${baseDllPath}/img/[name].[hash:8].[ext]`;
            return options;
          })
          .end();

        // 样式文件里的引用的静态资源地址，如 image,fonts...
        const langs = ['css', 'postcss', 'scss', 'sass', 'less', 'stylus'];
        const matches = ['vue-modules', 'vue', 'normal-modules', 'normal'];

        langs.forEach(lang =>
          matches.forEach(match =>
            config.module
              .rule(lang)
              .oneOf(match)
              .use('extract-css-loader')
              .loader(require('mini-css-extract-plugin').loader)
              .options({
                publicPath: '../../'
              })
          )
        );

        // 这种方式也可以
        // const types = ['vue-modules', 'vue', 'normal-modules', 'normal'];
        // types.forEach(type => addStyleResource(config.module.rule('css').oneOf(type)));
        //
        // function addStyleResource(rule) {
        //   rule.use('extract-css-loader')
        //     .loader(require('mini-css-extract-plugin').loader)
        //     .options({
        //       publicPath: './'
        //     }).end();
        // }

        // mini-css-extract-plugin
        config
          .plugin('extract-css')
          .use(require('mini-css-extract-plugin'), [extractOptions]);

        // set output
        forEachObj(dll.resolveOutput(), (fnName, value) => {
          // console.log('fnName, value', fnName, value);
          isFunctionAndCall(
            config.output[fnName],
            config.output,
            value
          );
        });
      });

      let webpackConfig = api.resolveWebpackConfig();
      let {VueLoaderPlugin} = require('vue-loader');
      let DefinePlugin = require('webpack/lib/DefinePlugin');
      let FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
      let NamedChunksPlugin = require('webpack/lib/NamedChunksPlugin');
      let MiniCssExtractPlugin = require('mini-css-extract-plugin');
      let fs = require('fs-extra');

      // filter plugins
      webpackConfig.plugins = webpackConfig.plugins.filter(i =>
        isInstallOf(
          i,
          VueLoaderPlugin,
          DefinePlugin,
          FriendlyErrorsWebpackPlugin,
          NamedChunksPlugin,
          MiniCssExtractPlugin,
          webpack.DllPlugin,
          FileNameCachePlugin
        )
      );
      // console.log('webpack', JSON.stringify(webpackConfig.plugins));
      // console.log('webpack', webpackConfig.plugins[2]);
      // webpackConfig.plugins[2].options.filename = '[name].[contenthash:8].css';
      // webpackConfig.plugins[2].options.chunkFilename = '[name].[contenthash:8].css';
      // reset entry
      webpackConfig.entry = dll.resolveEntry();
      // webpackConfig.output.publicPath = './';
      // console.log('webpackConfig', JSON.stringify(webpackConfig, null, 2));
      // remove dir
      fs.remove(dll.outputPath);

      log('Starting build dll...');
      return new Promise((resolve, reject) => {
        webpack(webpackConfig, (err, stats) => {
          if (err) {
            return reject(err);
          } else if (stats.hasErrors()) {
            return reject(new Error('Build failed with errors.'));
          }

          log('Build complete.');
          resolve();
        });
      });
    }
  );
};

module.exports.defaultModes = {
  dll: 'production'
};
