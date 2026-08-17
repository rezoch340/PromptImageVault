# PromptImageVault

本地优先的 AI 图片资产浏览器。它会索引挂载目录中的 PNG、JPG、JPEG、WebP、GIF 图片与 MP4、WebM 视频，生成缩略图（视频取首帧），并显示 Automatic1111 / Forge 与 ComfyUI 的生成参数。

前端和后端构建在同一个 Docker 镜像中：Vite 产物由 FastAPI 直接提供，浏览器通过同源 `/api` 和 `/ws` 访问后端，不需要跨域配置或额外的前端容器。

## Docker 启动

```bash
mkdir -p library
# 把图片放入 ./library，或把 IMAGE_LIBRARY 指向现有目录
IMAGE_LIBRARY=/absolute/path/to/images docker compose up --build
```

打开 <http://127.0.0.1:8000>。

索引与缩略图保存在 Docker volume 中，原图库以只读方式挂载。修改 `config.yaml` 可调整扫描周期、缩略图尺寸和图库配置。

## 本地开发

后端：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/dev-requirements.txt
PROMPT_IMAGE_VAULT_CONFIG=config.local.yaml uvicorn backend.main:application --reload
```

前端（使用 pnpm）：

```bash
cd frontend
pnpm install
pnpm dev
```

Vite 开发服务器位于 <http://127.0.0.1:5173>，并将同源 `/api` 和 `/ws` 请求代理到后端。

## 验证

```bash
pytest
cd frontend && pnpm lint && pnpm build
```

## API

- `GET /api/status`
- `GET /api/images?page=1&limit=100&sort=newest`
- `GET /api/image/{image_identifier}`
- `GET /api/thumbnail/{image_identifier}`
- `GET /api/metadata/{image_identifier}`
- `WS /ws`
