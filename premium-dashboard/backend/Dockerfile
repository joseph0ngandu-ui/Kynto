FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js authDb.js chatDb.js ./
EXPOSE 3001
CMD ["node", "server.js"]
