#!/bin/sh
npm install
cd packages/shared;npm install;cd -
cd apps/server;npm install;cd -