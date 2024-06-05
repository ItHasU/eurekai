const WebpackPwaManifest = require('webpack-pwa-manifest');
const path = require('path');

module.exports = require("@dagda/build/webpack-client.config")(__dirname);

// -- Add manifest.json to the output --
module.exports.plugins.push(new WebpackPwaManifest({
    name: 'eurekAI',
    short_name: 'eurekAI',
    description: "Génération d'image",
    background_color: '#ffffff',
    crossorigin: 'use-credentials', //can be null, use-credentials or anonymous
    icons: [
        {
            src: path.resolve('assets/icon.png'),
            sizes: [96, 128, 192, 256, 384, 512] // multiple sizes
        }
    ],
    inject: true,
    ios: true,
    publicPath: '.'
}));