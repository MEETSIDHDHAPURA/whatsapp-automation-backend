FROM ghcr.io/puppeteer/puppeteer:22.0.0

USER root
WORKDIR /usr/src/app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Set environment variables for Puppeteer on Render/Linux
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PORT=5000 \
    NODE_ENV=production

EXPOSE 5000

# Use non-root user bundled in puppeteer image
USER pptruser

CMD ["node", "server.js"]
