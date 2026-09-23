const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/** 
 * Build a worker script as a single file, without html or assets.
 * @param filename Name of the output file, a service worker is served at the root of the site
 */
function getWebpackConfig(dirname, entry = "src/main.ts", filename = "[name].js") {
  return {
    mode: "development", // or "production"
    devtool: "inline-source-map",
    entry: entry,
    output: {
      path: dirname + '/dist',
      filename: filename
    },
    target: "webworker",
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
        }
      ]
    },
    resolve: {
      extensions: [".js", ".ts"],
      plugins: [
        new TsconfigPathsPlugin({}),
      ],
    },
    plugins: [
    ]
  };

}

module.exports = getWebpackConfig;
