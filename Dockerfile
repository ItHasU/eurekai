FROM node:18-slim

COPY . /app
WORKDIR /app
RUN ./prepare.sh

WORKDIR /app/apps/client
RUN npm run build

WORKDIR /app/apps/server
RUN npm run build

WORKDIR /app
CMD ["node", "apps/server/dist/main.js"]