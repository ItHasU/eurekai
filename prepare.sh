#!/bin/sh
npm i --workspaces
npm i
npm run build --workspaces --if-present
