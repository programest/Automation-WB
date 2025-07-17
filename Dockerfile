# Базовый образ с Node.js
FROM node:20

# Установка Chromium и зависимостей
RUN apt-get update && apt-get install -y \
  chromium \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgdk-pixbuf2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  && rm -rf /var/lib/apt/lists/*

# Переменные окружения для Puppeteer
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_CACHE_DIR=/app/.cache

# Рабочая директория
WORKDIR /app

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm install

# Копирование всего кода
COPY . .

# Порт
EXPOSE 3000

# Команда запуска
CMD ["npm", "start"]