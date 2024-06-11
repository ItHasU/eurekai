const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");

/** Inspired by https://github.com/appzuka/project-references-example */
function getWebpackConfig(dirname, entry = "src/index.ts", assets = "assets/") {
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
          test: /\.html$/i,
          loader: "html-loader",
          options: {
            sources: {
              list: [
                "...",
                {
                  tag: "link",
                  attribute: "href",
                  type: "src",
                  filter: (tag, attribute, attributes, resourcePath) => {
                    const imgPath = attributes[1].value;
                    return !imgPath.startsWith("/" + assets);
                  },
                },
              ],
            },
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
        new TsconfigPathsPlugin({}),
      ],
      alias: {
        handlebars: 'handlebars/dist/handlebars.min.js'
      }
    },
    plugins: [
      new HtmlWebpackPlugin({ template: "./src/index.html" }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(dirname, assets),
            to: "assets"
          }
        ]
      })
    ]
  };

}

module.exports = getWebpackConfig;