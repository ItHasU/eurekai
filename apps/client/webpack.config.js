const WebpackPwaManifest = require('webpack-pwa-manifest');
const path = require('path');

module.exports = require("@dagda/build/webpack-client.config")(__dirname);

// -- Add manifest.json to the output --
module.exports.plugins.push(new WebpackPwaManifest({
    name: 'eurekAI',
    short_name: 'eurekAI',
    description: "Génération d'image",
    background_color: 'rgb(43, 48, 53)',
    theme_color: 'rgb(43, 48, 53)',
    crossorigin: 'use-credentials', //can be null, use-credentials or anonymous
    icons: [
        {
            src: path.resolve('assets/icon.png'),
            sizes: [96, 128, 192, 256, 384, 512, 1024] // multiple sizes
        },
        {
            src: path.resolve('assets/maskable_icon.png'),
            sizes: [96, 128, 192, 256, 384, 512, 1024],
            purpose: 'maskable'
        }
    ],
    inject: true,
    publicPath: '.',
    display: "fullscreen",
}));