# Optional container image for ChatToDO.
#   docker build -t chattodo .
#   docker run -it --env-file .env -v "$PWD/data:/app/data" chattodo
# The first run is interactive (-it) so you can read the pairing code; the
# mounted ./data volume keeps your WhatsApp login + tasks between restarts.
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV NODE_ENV=production
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
