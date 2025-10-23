# Base image (Debian-based, works perfectly on Raspberry Pi)
FROM node:18-bookworm

# 🧰 Install dependencies including libgpiod tools, SQLite headers, and ffmpeg for audio playback
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    gpiod libgpiod-dev libgpiod2 \
    libsqlite3-dev \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (for caching)
COPY ./core/package*.json ./

# Install Node dependencies (including better-sqlite3)
RUN npm install

# Copy the rest of the app
COPY ./core .

# ✅ Ensure data files are inside the container
COPY ./core/data ./data

# ✅ containers folder (safe guard)
RUN test -d containers || mkdir containers

# Rebuild any native modules (epoll, better-sqlite3, etc.)
RUN npm rebuild || true

EXPOSE 4000
CMD ["npm", "run", "dev"]
