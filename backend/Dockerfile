# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

# Build-time env vars for Vite (must be declared as ARG to be available during build)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# System deps: ffmpeg + python/pip (for yt-dlp and PO token provider)
RUN apk add --no-cache ffmpeg python3 py3-pip

# Install yt-dlp and bgutil PO token provider via pip.
# bgutil-yt-dlp-pot-provider generates YouTube PO tokens required on cloud IPs.
# Uses Node.js (already in this image) to run the token generation script.
RUN pip3 install --break-system-packages yt-dlp bgutil-yt-dlp-pot-provider \
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
