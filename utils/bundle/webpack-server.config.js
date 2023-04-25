const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const NodeExternals = require('webpack-node-externals');

/** Inspired by https://github.com/appzuka/project-references-example */
function getWebpackConfig(dirname, entry = "src/main.ts") {
  return {
    mode: "development", // or "production"
    watch: false,
    devtool: "inline-source-map",
    entry: entry,
    output: {
      path: dirname + '/dist',
      filename: "[name].js"
    },
    target: 'node', // use require() & use NodeJs CommonJS style
    context: dirname, // to automatically find tsconfig.json
    externals: [NodeExternals()], // in order to ignore all modules in node_modules folder
    externalsPresets: {
        node: true // in order to ignore built-in modules like path, fs, etc. 
    },
    module: {
      "rules": [
        {
          "test": /\.ts?$/,
          "exclude": /node_modules/,
          "use": {
            "loader": "ts-loader",
            "options": {
              "transpileOnly": false, // Set to true if you are using fork-ts-checker-webpack-plugin
              "projectReferences": true
            }
          }
        }
      ]
    },
    resolve: {
      extensions: [".js", ".ts"],
      plugins: [
        new TsconfigPathsPlugin({})
      ]
    },
    plugins: [
    ]
  };

}

module.exports = getWebpackConfig;