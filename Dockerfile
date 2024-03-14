FROM node:18-slim

ENV PORT=3000
EXPOSE 3000
WORKDIR /app

# Install extra packages
RUN apt-get update && \
    apt-get install -y wakeonlan && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . /app
RUN ./prepare.sh

WORKDIR /app
CMD ["node", "apps/server/dist/main.js"]