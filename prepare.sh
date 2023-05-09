#!/bin/sh
npm install --build-from-source
cd packages/shared;npm install --build-from-source;cd -
cd apps/server;npm install --build-from-source;cd -
cd apps/client;npm install --build-from-source;cd -