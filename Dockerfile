FROM node:20-slim

# Install system dependencies for yt-dlp and better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
COPY .npmrc* ./

# Install npm packages
RUN npm install --allow-git=all && npm install lyrics-lib

COPY . .

# Create data directory
RUN mkdir -p /app/data

CMD ["npm", "start"]
