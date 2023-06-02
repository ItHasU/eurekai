FROM node:18-slim

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

COPY . /app
WORKDIR /app
RUN ./prepare.sh

WORKDIR /app
CMD ["node", "apps/server/dist/main.js"]