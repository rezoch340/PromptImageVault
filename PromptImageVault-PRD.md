# PromptImageVault

## Local AI Image Explorer & Metadata Inspector

一个 Docker 化、本地优先的 AI 图片资产浏览器。

目标：像 Finder / Lightroom 一样浏览 AI 生成图片，同时像 Stable
Diffusion Inspector 一样查看 Prompt、Seed、Model 等生成参数。

## 技术栈

Frontend: - React - Vite - TypeScript

Backend: - Python 3 - FastAPI - Pillow - watchdog - Uvicorn

## 核心架构

采用 App Shell 架构：

-   Sidebar / Header 静态 UI 必须立即显示
-   图片列表、缩略图、metadata 独立加载
-   禁止全局 loading 阻塞整个页面

加载状态拆分：

-   imageListLoading
-   thumbnailLoading
-   metadataLoading
-   scannerLoading

## Docker

通过 docker-compose 运行。

图片目录通过 volume 挂载：

宿主机: AI 图片目录

容器: `/library`

配置文件：

`config.yaml`

示例：

``` yaml
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

## 图片扫描

支持：

-   png
-   jpg
-   jpeg
-   webp

要求：

-   增量扫描
-   新图片发现
-   删除检测
-   修改检测

文件系统作为唯一真实来源。

索引只是缓存。

## 文件监听

使用 watchdog：

监听：

-   CREATE
-   MODIFY
-   DELETE
-   MOVE

支持 WebSocket 通知前端新增图片。

监听失败时 fallback 到定时扫描。

## 排序

默认：

`created_time DESC`

支持：

-   Newest
-   Oldest
-   Filename
-   Resolution
-   File Size
-   Seed
-   Model
-   Sampler
-   Steps
-   CFG

排序基于索引，不重新读取图片。

## Thumbnail

缓存：

    /cache/thumbnails

格式：

webp

尺寸：

约 400px

## Metadata Inspector

点击图片显示：

-   Prompt
-   Negative Prompt
-   Seed
-   Model
-   Steps
-   Sampler
-   CFG
-   Resolution
-   其他参数

支持：

-   ESC关闭
-   左右切换
-   Copy Prompt
-   Copy Negative
-   Copy All

## Stable Diffusion Metadata

支持：

### Automatic1111 / Forge

读取：

`PNG parameters`

解析：

-   prompt
-   negative_prompt
-   steps
-   sampler
-   scheduler
-   cfg_scale
-   seed
-   width
-   height
-   model
-   model_hash
-   clip_skip
-   VAE
-   LoRA
-   Hires

未知字段保存 extras。

### ComfyUI

读取：

-   prompt
-   workflow

保留 raw JSON。

尝试提取：

-   positive prompt
-   negative prompt
-   seed
-   steps
-   cfg
-   sampler
-   scheduler
-   checkpoint

## API

    GET /api/images

    GET /api/images?page=1&limit=100

    GET /api/image/{image_identifier}

    GET /api/thumbnail/{image_identifier}

    GET /api/metadata/{image_identifier}

## 安全

要求：

-   防 path traversal
-   文件访问限制在图库目录
-   默认 localhost
-   文件类型白名单

## 项目结构

    PromptImageVault/

    ├── docker-compose.yml
    ├── Dockerfile
    ├── config.yaml

    ├── backend/
    │   ├── main.py
    │   ├── config.py
    │   ├── scanner.py
    │   ├── watcher.py
    │   ├── thumbnail.py
    │   └── metadata/
    │       ├── parser.py
    │       ├── a1111.py
    │       └── comfyui.py

    └── frontend/
        └── src/
            ├── PromptImageVaultApplication.tsx
            ├── ImageGrid.tsx
            ├── ImageViewer.tsx
            └── Inspector.tsx

## 版本规划

### v0.1

-   Docker
-   React UI
-   FastAPI
-   config.yaml
-   图片扫描
-   增量索引
-   缩略图缓存
-   排序
-   A1111解析
-   ComfyUI基础解析

### v0.2

-   Prompt 搜索
-   Model过滤
-   Seed搜索
-   LoRA识别

### v0.3

-   相似图片
-   Embedding
-   自动标签
-   批次识别

## 开发原则

优先级：

1.  打开速度
2.  图片浏览体验
3.  增量能力
4.  Metadata准确性
5.  扩展性

目标：

-   像 Finder 一样快
-   像 Lightroom 一样浏览
-   像 Stable Diffusion Inspector 一样查看参数
