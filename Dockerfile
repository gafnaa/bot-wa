# Gunakan Node.js versi LTS slim
FROM node:18-slim

# Install dependencies sistem
# PERBAIKAN: Kita menambahkan 'git' di baris ke-6 agar npm bisa download dari GitHub
RUN apt-get update \
    && apt-get install -y wget gnupg git \
    && apt-get install -y chromium \
    && apt-get install -y ffmpeg \
    && apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set Environment Variables untuk Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Setup working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies Node.js (sekarang sudah ada git, jadi ini akan berhasil)
RUN npm install

# Copy seluruh source code
COPY . .

# Command start
CMD ["node", "index.js"]