FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY postcss.config.mjs ./
COPY default_shadcn_theme.css ./
COPY artifect ./artifect
RUN npm run build


FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
COPY backend ./backend
COPY artifect ./artifect
COPY --from=frontend-builder /app/dist ./dist

RUN pip install --no-cache-dir -r requirements.txt

CMD gunicorn backend.app:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-10000} --timeout 180 --graceful-timeout 30 --log-file -
