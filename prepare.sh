#!/bin/sh
npm i --workspaces
npm i
npm run build --workspaces --if-present
npm run test --workspaces --if-present
