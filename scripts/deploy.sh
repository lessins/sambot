#!/usr/bin/env bash
# deploy to wlessin.com
# runs on the host after git pull

set -e

echo "[deploy] sambot → wlessin.com"

npm ci
npm run build

# reload pm2 process
if pm2 list | grep -q "sambot"; then
  pm2 reload sambot --update-env
else
  pm2 start dist/index.js --name sambot --env production
fi

pm2 save
echo "[deploy] done"
