#!/bin/bash
test -f "./packages/web/.env.production.local" || echo $WEB_PROD_EMV | base64 -d > ./packages/web/.env.production.local
test -f "./packages/server/.env" || echo $SERVER_DEV_EMV | base64 -d > ./packages/server/.env
yarn
yarn build
yarn start
