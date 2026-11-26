# Finovo Souq API
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Uploaded photos and voice messages live in a volume, owned by the unprivileged node user
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/v1/health > /dev/null || exit 1

CMD ["node", "src/server.js"]
