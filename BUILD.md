# PromptImageVault 构建与发布手册

本文用于本地开发、质量验证、Docker 镜像构建、Docker Hub 发布和服务器更新。命令默认在项目根目录执行。

## 1. 项目结构

- `frontend/`：React + TypeScript + Vite 前端，使用 pnpm。
- `backend/`：FastAPI 后端，负责文件扫描、元数据解析、缩略图和视频首帧生成。
- `config.yaml`：容器内生产配置。
- `config.local.yaml`：本地开发配置。
- `Dockerfile`：多阶段单镜像构建，前端产物由 FastAPI 提供。
- `docker-compose.yml`：本机 Docker Compose 启动配置。
- `tests/`：Python 自动化测试。

生产镜像同时包含前端和后端，不需要单独部署前端容器，也不需要配置跨域。浏览器通过同源 `/api` 和 `/ws` 访问后端。

## 2. 环境要求

- Git
- Docker Desktop 或 Docker Engine，建议 Docker 24 以上
- Docker Buildx，用于多架构镜像发布
- Node.js 24
- pnpm 10.14.0
- Python 3.12

确认环境：

```bash
git --version
docker version
docker buildx version
node --version
corepack pnpm@10.14.0 --version
python3 --version
```

## 3. 获取代码

```bash
git clone git@github.com:rezoch340/PromptImageVault.git
cd PromptImageVault
```

如果目录已经存在：

```bash
git status -sb
git pull --ff-only
```

工作区存在未提交修改时，不要直接覆盖、重置或清理，应先确认修改来源。

## 4. 前端构建

安装依赖：

```bash
corepack pnpm@10.14.0 --dir frontend install --frozen-lockfile
```

代码检查和生产构建：

```bash
corepack pnpm@10.14.0 --dir frontend lint
corepack pnpm@10.14.0 --dir frontend build
```

构建产物位于 `frontend/dist/`。该目录由 Git 忽略，Docker 构建时会在镜像内部重新生成。

本地前端开发服务器：

```bash
corepack pnpm@10.14.0 --dir frontend dev
```

默认地址为 <http://127.0.0.1:5173>。Vite 会把 `/api` 和 `/ws` 代理到本地后端。

## 5. 后端开发与测试

创建虚拟环境并安装依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/dev-requirements.txt
```

准备本地图库：

```bash
mkdir -p library
```

启动后端：

```bash
PROMPT_IMAGE_VAULT_CONFIG=config.local.yaml \
uvicorn backend.main:application --reload --host 127.0.0.1 --port 8000
```

运行测试：

```bash
pytest
```

## 6. 完整质量验证

提交或发布前至少执行：

```bash
pytest
corepack pnpm@10.14.0 --dir frontend lint
corepack pnpm@10.14.0 --dir frontend build
git diff --check
```

所有命令必须成功退出。前端变更还应在浏览器中验证图片切换、滚轮缩放、拖拽、手机双指缩放和元数据展示。

## 7. 本地 Docker 构建

构建本机架构镜像：

```bash
docker build --tag prompt-image-vault:local .
```

使用项目内测试目录运行：

```bash
mkdir -p library
docker volume create prompt-image-vault-cache

docker rm --force prompt-image-vault 2>/dev/null || true

docker run --detach \
  --name prompt-image-vault \
  --restart unless-stopped \
  --publish 127.0.0.1:8000:8000 \
  --volume "$(pwd)/library:/library:ro" \
  --volume prompt-image-vault-cache:/cache \
  prompt-image-vault:local
```

使用现有 ComfyUI 目录运行：

```bash
docker rm --force prompt-image-vault 2>/dev/null || true

docker run --detach \
  --name prompt-image-vault \
  --restart unless-stopped \
  --publish 127.0.0.1:8000:8000 \
  --volume /Users/lpitiless/Documents/remote-ssh/ComfyUI:/library:ro \
  --volume prompt-image-vault-cache:/cache \
  prompt-image-vault:local
```

验证：

```bash
docker ps --filter name=prompt-image-vault
docker logs --tail 100 prompt-image-vault
curl --fail http://127.0.0.1:8000/api/status
```

浏览器打开 <http://127.0.0.1:8000>。

## 8. Docker Compose 启动

`docker-compose.yml` 默认只监听本机 `127.0.0.1:8000`。

```bash
IMAGE_LIBRARY=/absolute/path/to/images docker compose up --detach --build
```

查看状态：

```bash
docker compose ps
docker compose logs --tail 100
```

停止服务：

```bash
docker compose down
```

如果重新执行 Compose 命令，必须继续提供 `IMAGE_LIBRARY`，否则会回退到项目内的 `./library`。

## 9. 容器目录和配置

生产容器约定：

| 容器路径 | 用途 | 推荐权限 |
| --- | --- | --- |
| `/library` | 图片和视频源目录 | 只读 |
| `/cache` | 索引数据库、缩略图和视频首帧缓存 | 读写 |
| `/application/config.yaml` | 应用配置 | 只读 |

镜像已经内置 `/application/config.yaml`，默认配置为：

```yaml
server:
  host: 0.0.0.0
  port: 8000

libraries:
  - name: default
    path: /library
    recursive: true

scanner:
  watch: true
  interval: 60

thumbnail:
  size: 400
  format: webp

cache:
  directory: /cache
```

默认情况下不需要额外挂载配置文件。需要自定义时再添加：

```bash
--volume /host/path/config.yaml:/application/config.yaml:ro
```

## 10. Git 提交与推送

只有在明确要求推送时才执行本节。

```bash
git status --short
git diff --check
git add <本次修改的文件>
git commit -m "feat: 中文提交说明"
git push
```

推送后确认：

```bash
git status -sb
```

状态应显示当前分支与远端同步，且没有未提交文件。

## 11. Docker Hub 多架构发布

当前发布目标：

```text
lpitiless/prompt-image-vault:latest
```

先确认已经登录：

```bash
docker login
```

构建并直接推送 `linux/amd64` 和 `linux/arm64`：

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag lpitiless/prompt-image-vault:latest \
  --push \
  .
```

验证远端清单：

```bash
docker buildx imagetools inspect lpitiless/prompt-image-vault:latest
```

输出必须同时包含：

```text
linux/amd64
linux/arm64
```

## 12. 服务器首次部署

服务器图片目录：`/AI/output`

```bash
mkdir -p /AI/prompt-image-vault-cache

docker pull lpitiless/prompt-image-vault:latest

docker rm --force prompt-image-vault 2>/dev/null || true

docker run --detach \
  --name prompt-image-vault \
  --restart unless-stopped \
  --publish 8000:8000 \
  --volume /AI/output:/library:ro \
  --volume /AI/prompt-image-vault-cache:/cache \
  lpitiless/prompt-image-vault:latest
```

访问地址：

```text
http://服务器IP地址:8000
```

## 13. 服务器更新

仅执行 `docker restart` 不会切换到新镜像。必须先拉取，再重新创建容器：

```bash
docker pull lpitiless/prompt-image-vault:latest

docker rm --force prompt-image-vault 2>/dev/null || true

docker run --detach \
  --name prompt-image-vault \
  --restart unless-stopped \
  --publish 8000:8000 \
  --volume /AI/output:/library:ro \
  --volume /AI/prompt-image-vault-cache:/cache \
  lpitiless/prompt-image-vault:latest
```

更新后检查：

```bash
docker ps --filter name=prompt-image-vault
docker logs --tail 100 prompt-image-vault
curl --fail http://127.0.0.1:8000/api/status
```

## 14. 常见问题

### 页面显示零个文件

检查挂载：

```bash
docker inspect prompt-image-vault \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

确认宿主机图库映射到 `/library`，并且 Docker 进程有读取权限。

### 端口被占用

将宿主机端口改为其他值，容器端口保持 `8000`：

```bash
--publish 8080:8000
```

随后访问 `http://服务器IP地址:8080`。

### 更新后仍是旧版本

确认执行了 `docker pull` 和容器重建，而不是只执行 `docker restart`：

```bash
docker image inspect lpitiless/prompt-image-vault:latest \
  --format '{{index .RepoDigests 0}}'
```

### 缓存无法写入

确认 `/AI/prompt-image-vault-cache` 存在且 Docker 可以写入：

```bash
mkdir -p /AI/prompt-image-vault-cache
ls -ld /AI/prompt-image-vault-cache
```

### 查看完整日志

```bash
docker logs --follow prompt-image-vault
```

## 15. 发布检查清单

- Python 测试通过。
- 前端 pnpm lint 通过。
- 前端 pnpm build 通过。
- `git diff --check` 通过。
- 本地容器能够启动。
- `/api/status` 返回成功。
- 图片、视频、缩略图和元数据能够正常显示。
- 图片切换无闪屏。
- 鼠标滚轮、拖拽和手机双指缩放正常。
- GitHub 推送成功。
- Docker Hub 同时存在 `linux/amd64` 和 `linux/arm64` 清单。
- 服务器使用新镜像重新创建容器后运行正常。
