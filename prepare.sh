#!/bin/sh
cd packages/node-sqlite3-master;npm install --build-from-source;cd -
cd packages/shared;npm install;cd -
cd apps/server;npm install;cd -
cd apps/client;npm install;cd -