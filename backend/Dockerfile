# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# System deps: ffmpeg + curl (for yt-dlp download)
RUN apk add --no-cache ffmpeg python3 curl

# Download latest yt-dlp binary from GitHub releases
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && yt-dlp --version

# Install backend dependencies (production only)
COPY backend/package.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create directories that the app writes to at runtime
RUN mkdir -p downloads tmp

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
