#!/bin/sh
cd packages/shared;npm install;cd -
cd apps/server;npm install;cd -
cd apps/client;npm install;cd -
npm install