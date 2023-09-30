const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/** Inspired by https://github.com/appzuka/project-references-example */
function getWebpackConfig(dirname, entry = "src/main.ts", node_modules = []) {
  return {
    mode: "development", // or "production"
    watch: false,
    devtool: "inline-source-map",
    entry: entry,
    output: {
      path: dirname + '/dist',
      filename: "[name].js"
    },
    context: dirname, // to automatically find tsconfig.json
    externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
    externalsType: "commonjs",
    externals: node_modules,
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