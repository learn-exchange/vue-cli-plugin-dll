module.exports = (api, options, rootOptions) => {
  api.extendPackage({
    scripts: {
      dll: 'vue-cli-service dll'
    }
  });
};
