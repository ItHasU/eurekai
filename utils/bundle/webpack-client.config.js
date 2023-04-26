const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/** Inspired by https://github.com/appzuka/project-references-example */
function getWebpackConfig(dirname, entry = "src/index.ts") {
  return {
    mode: "development", // or "production"
    devtool: "inline-source-map",
    entry: entry,
    output: {
      path: dirname + '/dist',
      filename: "[name].js"
    },
    watch: false,
    context: dirname, // to automatically find tsconfig.json
    module: {
      rules: [
        {
          test: /\.ts?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: false, // Set to true if you are using fork-ts-checker-webpack-plugin
              projectReferences: true
            }
          }
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
      ]
    },
    resolve: {
      modules: [
        "node_modules",
        path.resolve(dirname)
      ],
      // TsconfigPathsPlugin will automatically add this
      // alias: {
      //   packages: path.resolve(__dirname, 'packages/'),
      // },
      extensions: [".js", ".ts"],
      plugins: [
        new TsconfigPathsPlugin({})
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({ template: "./src/index.html" })
    ]
  };

}

module.exports = getWebpackConfig;