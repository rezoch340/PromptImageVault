FROM node:24-alpine AS frontend-build
WORKDIR /build/frontend
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROMPT_IMAGE_VAULT_CONFIG=/application/config.yaml
WORKDIR /application
COPY backend/requirements.txt /tmp/requirements.txt
# ponytail: PyAV wheels bundle ffmpeg, so no apt-get ffmpeg layer is needed.
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY backend/ ./backend/
COPY config.yaml ./config.yaml
COPY --from=frontend-build /build/frontend/dist ./frontend/dist
EXPOSE 8000
CMD ["uvicorn", "backend.main:application", "--host", "0.0.0.0", "--port", "8000"]
