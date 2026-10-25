# One image serves every app. In compose, ./apps is mounted over /srv/apps so new apps are live without a rebuild.
FROM node:20-alpine
WORKDIR /srv
COPY package.json .
RUN npm install --omit=dev
COPY shared ./shared
COPY apps ./apps
CMD ["node", "shared/server.js"]
