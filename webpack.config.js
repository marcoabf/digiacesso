//const path = require("path");

module.exports = {
  entry: {
    user: "./public/src/vue.js",
    config: "./public/src/vueAdmin.js",
    guest: "./public/src/vueGuest.js",
  },
  output: {
    libraryTarget: "umd",
    globalObject: "this",
    filename: "[name].js",
    path: __dirname + "/public/dist",
  },
  target: "web",
  resolve: {
    alias: {
      vue$: "vue/dist/vue.esm.js", // 'vue.common.js' para webpack 1
    },
  },
  // node: {
  //   fs: "empty"
  // }
};
