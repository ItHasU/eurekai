const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './build/index.js',
  mode: "production",
  plugins: [
    new HtmlWebpackPlugin({
      // Load a custom template (lodash by default)
      template: './src/index.html'
    }),
  ],
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
};