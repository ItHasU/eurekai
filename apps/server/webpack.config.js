module.exports = require("@dagda/build/webpack-server.config")(__dirname, "./src/main.ts", ["better-sqlite3", "express", "ws", "pg", "passport", "passport-google-oauth20", "openai", "wol"]);
