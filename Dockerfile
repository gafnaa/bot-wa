# Gunakan Node.js versi LTS slim agar lebih ringan
FROM node:18-slim

# Install dependencies sistem yang dibutuhkan untuk Puppeteer (Chromium) & FFmpeg
# Kita install chromium & ffmpeg secara manual lewat apt-get
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && apt-get install -y chromium \
    && apt-get install -y ffmpeg \
    && apt-get install -y fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set Environment Variables
# Ini memberitahu Puppeteer untuk menggunakan Chromium yang sudah kita install (bukan download lagi)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Buat folder kerja di dalam container
WORKDIR /app

# Copy package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Install dependencies Node.js
RUN npm install

# Copy seluruh sisa kode source ke dalam container
COPY . .

# Command untuk menjalankan bot
CMD ["node", "index.js"]