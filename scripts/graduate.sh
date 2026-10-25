#!/usr/bin/env bash
# Roll a winning app out as its own standalone project: scripts/graduate.sh <id> [target-dir] [port]
# Creates <target-dir> (default ../<id>) with the app, the shared server, a Dockerfile and its own MongoDB.
# Pass --move-data to also copy this app's database out of the hub's MongoDB into the new project's volume.
set -e
cd "$(dirname "$0")/.."
id=$1; dest=${2:-../$id}; port=${3:-3000}
[ -d apps/$id ] || { echo "no such app: $id"; exit 1; }
[ ! -e "$dest" ] || { echo "$dest already exists"; exit 1; }
mkdir -p "$dest/app" "$dest/server"
cp apps/$id/* "$dest/app/"
cp -r shared/public "$dest/server/public"
cp shared/server.js "$dest/server/server.js"
cp package.json "$dest/package.json"
cat > "$dest/Dockerfile" <<EOF
FROM node:20-alpine
WORKDIR /srv
COPY package.json .
RUN npm install --omit=dev
COPY server ./shared
COPY app ./apps/$id
ENV SINGLE_APP=$id
CMD ["node", "shared/server.js"]
EOF
cat > "$dest/docker-compose.yml" <<EOF
services:
  mongo:
    image: mongo:7
    volumes: [mongo-data:/data/db]
    healthcheck: { test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"], interval: 5s, retries: 10 }
  app:
    build: .
    ports: ["$port:3000"]
    depends_on: { mongo: { condition: service_healthy } }
    restart: unless-stopped
volumes: { mongo-data: {} }
EOF
cat > "$dest/README.md" <<EOF
# $id
Graduated from the cool-apps hub. Run: \`docker compose up -d --build\` then open http://localhost:$port
EOF
echo "created $dest  (docker compose up -d --build, then http://localhost:$port)"
echo "To bring existing data along: docker compose -f $PWD/docker-compose.yml exec -T mongo mongodump --archive --db $id | (cd $dest && docker compose up -d mongo && docker compose exec -T mongo mongorestore --archive)"
