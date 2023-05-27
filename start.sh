#!/bin/bash
test -f "./apps/web/.env.production.local" || echo $WEB_PROD_ENV | base64 -d > ./apps/web/.env.production.local
test -f "./apps/server/.env" || echo $SERVER_PROD_ENV | base64 -d > ./apps/server/.env
mkdir -p ./apps/server/tessdata
mkdir -p ./apps/server/cache
pnpm install
pnpm build
pnpm start
