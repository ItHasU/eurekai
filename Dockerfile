FROM node:18-slim

COPY . /app
WORKDIR /app
RUN ./prepare.sh

WORKDIR /app
CMD ["node", "apps/server/dist/main.js"]