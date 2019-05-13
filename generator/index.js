module.exports = (api, options, rootOptions) => {
  api.extendPackage({
    scripts: {
      dll: 'vue-cli-service dll'
    },
    vue: {
      pluginOptions: {
        dll: {
          entry: {
            vendor: ['vue', 'vue-router']
          },
          output: path.join(__dirname, './public/vendor'),
        }
      }
    }
  });
};
