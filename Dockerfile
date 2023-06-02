FROM node:18-slim

ENV PORT=3000
EXPOSE 3000
WORKDIR /app

COPY . /app
RUN ./prepare.sh

WORKDIR /app
CMD ["node", "apps/server/dist/main.js"]