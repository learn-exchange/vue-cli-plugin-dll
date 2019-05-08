const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/**
 * is plain object
 * @param {any} i validate source
 * @return {Boolean} result
 */
const isObject = i => Object.prototype.toString.call(i) === '[object Object]';

/**
 * forEach Object
 * @param {Object} obj target Source
 * @param {*} callback callback
 */
const forEachObj = (obj, callback) => {
  if (!isObject(obj)) return false;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) callback(key, obj[key]);
  }
  return obj;
};

/**
 * is function to call
 * @param {Function} fn target Func
 * @param {Object} context fn context
 * @param {...any} args fn arguments
 * @returns result of function call
 */
const isFunctionAndCall = (fn, context, ...args) => {
  return typeof fn === 'function' && fn.apply(context, args);
};

/**
 * extend object
 * @param {Object} target target
 * @param {...Object} sources sourceList
 * @returns {Object} target
 */
const merge = (target, ...sources) => {
  sources.forEach(sourceItem => {
    if (!isObject(sourceItem)) {
      return;
    }
    forEachObj(sourceItem, (key, value) => {
      target[key] = value;
    });
  });
  return target;
};

const log = msg => {
  msg && console && console.log && console.log(msg);
};

const isInstallOf = (target, ...classList) => {
  return classList.some(C => target instanceof C);
};

const compose = function compose(...funs) {
  let length = funs.length;
  if (length === 0) {
    return i => i;
  } else if (length === 1) {
    return funs[0];
  }
  return funs.reduce((a, b) => (...args) => a(b(...args)));
};

// match dll
const MatchEntryNameREG = /^(dll)$|^dll_([a-zA-Z]+)/;
exports.MatchEntryName_REG = MatchEntryNameREG;
exports.getEntryByWConfig = entry => {
  if (!isObject(entry)) {
    return {};
  }
  let entryKeys = Object.keys(entry);
  return entryKeys
    .map(i => {
      let result = i.match(MatchEntryNameREG);
      if (result) {
        let {1: defaultName, 2: entryName} = result;
        return defaultName || entryName;
      }
      return result;
    })
    .filter(i => !!i)
    .reduce((newEntry, name) => {
      let enteryKey = name === 'dll' ? name : `dll_${name}`;
      newEntry[name] = entry[enteryKey];
      return newEntry;
    }, {});
};

exports.normalizeRntry = (entry = {}) => {
  if (!isObject(entry) && entry) {
    entry = {
      dll: entry
    };
  }

  forEachObj(entry, (name, entryValue) => {
    entry[name] = Array.isArray(entryValue) ? entryValue : [entryValue];
  });
  return entry;
};

exports.tryGetManifestJson = jsonPath => {
  let getJon = null;
  try {
    getJon = require(jsonPath);
  } catch (e) {
    log(' ');
    log('vue-cli-plugin-dll warning!! miss manifest.json');
    log(' ');
    log(' ');
    log(`no found ${jsonPath}`);
    log(' ');
    log(
      `if you want to use DllReferencePlugin，execute the command 'npm run dll' first`
    );
    log(' ');
  }
  return getJon;
};

exports.replaceAsyncName = i => i.replace(/\[.+\]/g, '*');

/**
 * get file type
 * @param {String} filePath
 */
const getFileType = filePath => {
  return filePath.substring(filePath.lastIndexOf('.') + 1);
};

const isAcceptTypeByAssetPlugin = typeOfAsset => {
  return /js|css/.test(typeOfAsset);
};

const isAcceptTypeByAssetPluginByPath = compose(
  isAcceptTypeByAssetPlugin,
  getFileType
);

/**
 * get default Args for add-asset-html-webpack-plugin plugin
 * @param {string} filepath filePath
 */
const getAssetHtmlPluginDefaultArg = filepath => {
  // 获取格式
  let typeOfAsset = getFileType(filepath);
  if (!isAcceptTypeByAssetPlugin(typeOfAsset)) {
    return false;
  }
  return {
    filepath,
    includeSourcemap: false,
    typeOfAsset: typeOfAsset,
    publicPath: typeOfAsset,
    outputPath: typeOfAsset
  };
};

const cssLoaders = (options) => {
  options = options || {};

  const cssLoader = {
    loader: 'css-loader',
    options: {
      minimize: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'dll',
      sourceMap: options.sourceMap
    }
  };

  const postcssLoader = {
    loader: 'postcss-loader',
    options: {
      sourceMap: options.sourceMap
    }
  };

  // generate loader string to be used with extract text plugin
  function generateLoaders(loader, loaderOptions) {
    const loaders = [];

    // Extract CSS when that option is specified
    // (which is the case during production build)
    if (options.extract) {
      loaders.push({
        loader: MiniCssExtractPlugin.loader,
        options: {
          // you can specify a publicPath here
          // by default it use publicPath in webpackOptions.output
          // 解决图片作为背景引入时，路径不对的问题
          publicPath: '../../'
        }
      });
    } else {
      loaders.push('vue-style-loader');
    }

    loaders.push(cssLoader);

    if (options.usePostCSS) {
      loaders.push(postcssLoader);
    }

    if (loader) {
      loaders.push({
        loader: loader + '-loader',
        options: Object.assign({}, loaderOptions, {
          sourceMap: options.sourceMap
        })
      });
    }

    return loaders;
  }

  // https://vue-loader.vuejs.org/en/configurations/extract-css.html
  return {
    css: generateLoaders(),
    postcss: generateLoaders(),
    less: generateLoaders('less'),
    sass: generateLoaders('sass', {indentedSyntax: true}),
    scss: generateLoaders('sass'),
    stylus: generateLoaders('stylus'),
    styl: generateLoaders('stylus')
  };
};

// Generate loaders for standalone style files (outside of .vue)
const styleLoaders = (options) => {
  const output = [];
  const loaders = cssLoaders(options);
  for (const extension in loaders) {
    const loader = loaders[extension];
    output.push({
      test: new RegExp('\\.' + extension + '$'),
      use: loader
    });
  }
  return output;
};


exports.log = log;
exports.merge = merge;
exports.compose = compose;
exports.getFileType = getFileType;
exports.isObject = isObject;
exports.forEachObj = forEachObj;
exports.isInstallOf = isInstallOf;
exports.isFunctionAndCall = isFunctionAndCall;
exports.getAssetHtmlPluginDefaultArg = getAssetHtmlPluginDefaultArg;
exports.isAcceptTypeByAssetPluginByPath = isAcceptTypeByAssetPluginByPath;
exports.styleLoaders = styleLoaders;
