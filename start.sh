#!/bin/bash
test -f "./packages/web/.env.production.local" || echo $WEB_PROD_ENV | base64 -d > ./packages/web/.env.production.local
test -f "./packages/server/.env" || echo $SERVER_PROD_ENV | base64 -d > ./packages/server/.env
mkdir -p ./packages/server/tessdata
mkdir -p ./packages/server/cache
pnpm install
pnpm build
pnpm start
