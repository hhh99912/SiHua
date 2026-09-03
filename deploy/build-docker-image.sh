#!/bin/bash
# ==============================================================================
# 在 Ubuntu 编译机上执行：1. 容器内打包 -> 2. 生成抗模糊启动脚本 -> 3. 构建 Docker 镜像 -> 4. 导出 tar 包
# ==============================================================================

set -e

APP_NAME="ge-scada-app"
IMAGE_TAG="latest"
TAR_NAME="ge-scada-app.tar"

echo "========================================================"
echo "Step 1: 使用内置环境容器编译前端与 Electron Linux 程序..."
echo "========================================================"

docker run --rm \
  -v $(pwd):/app \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  -w /app \
  -e ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" \
  -e ELECTRON_CUSTOM_DIR="{{ version }}" \
  -e NODE_TLS_REJECT_UNAUTHORIZED=0 \
  node:22.21.1-slim \
  /bin/bash -c "
    apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && update-ca-certificates && \
    mkdir -p /root/.cache/electron /root/.cache/electron-builder && \
    if [ ! -f /root/.cache/electron/electron-v14.2.9-linux-x64.zip ]; then
      echo '>>> 预先下载 Electron 14.2.9 安装包...' && \
      curl -k -fsSL https://npmmirror.com/mirrors/electron/14.2.9/electron-v14.2.9-linux-x64.zip -o /root/.cache/electron/electron-v14.2.9-linux-x64.zip || true && \
      curl -k -fsSL https://npmmirror.com/mirrors/electron/14.2.9/SHASUMS256.txt -o /root/.cache/electron/SHASUMS256.txt-14.2.9 || true
    fi && \
    npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com/ && \
    pnpm config set enable-pre-post-scripts true && \
    pnpm install || npm install --include=optional && \
    npx vite build && \
    npx esbuild electron/main.ts --bundle --platform=node --target=node14 --format=cjs --outfile=dist-electron/main.cjs --external:electron && \
    npx esbuild electron/preload.ts --bundle --platform=node --target=node14 --format=cjs --outfile=dist-electron/preload.cjs --external:electron && \
    npx electron-builder --config electron-builder.json5 --linux dir
  "

UNPACKED_DIR=$(find . -maxdepth 3 -type d -name "linux-unpacked" | head -n 1 | sed 's|^\./||')
echo "=== 产物目录为: ${UNPACKED_DIR} ==="

echo "========================================================"
echo "Step 2: 生成注入次像素渲染与 Fcitx 支持的 start.sh 启动脚本..."
echo "========================================================"

cat > start.sh << 'EOF'
#!/bin/bash

# --- 1. 强制 UTF-8 字符集与 FreeType v40 亚像素渲染引擎 ---
export LANG="C.UTF-8"
export LC_ALL="C.UTF-8"
export LC_CTYPE="C.UTF-8"
export FREETYPE_PROPERTIES="truetype:interpreter-version=40 cff:no-stem-darkening=0 type1:no-stem-darkening=0"

# --- 2. 输入法通信通道 ---
export XMODIFIERS="@im=fcitx"
export GTK_IM_MODULE="xim"
export QT_IM_MODULE="xim"
export NO_AT_BRIDGE=1

APP_EXEC=$(find /app -maxdepth 1 -type f -executable ! -name '*.so*' ! -name 'chrome*' ! -name 'start.sh' | head -n 1)

if [ -z "$APP_EXEC" ]; then
    echo "[错误] 容器内未找到主程序！"
    exit 1
fi

echo "=== 启动工控大屏程序: $APP_EXEC ==="
chmod +x "$APP_EXEC"

# --- 3. 核心关键渲染参数：强制次像素文本、开启中等物理网格微调、禁止灰阶降级模糊 ---
exec "$APP_EXEC" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu-sandbox \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --font-render-hinting=medium \
  --enable-font-antialiasing \
  --force-color-profile=srgb \
  --enable-features=FontAccess,CanvasOopRasterization,RawDraw \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-smooth-scrolling \
  --disable-breakpad \
  --disable-component-update \
  --disable-sync \
  --disable-background-networking \
  --disable-features=AudioServiceSandbox,GlobalMediaControls,MediaSessionService
EOF

chmod +x start.sh

echo "========================================================"
echo "Step 3: 构建 Docker 镜像..."
echo "========================================================"

cat > Dockerfile << EOF
FROM ge-scada-env:latest
COPY ${UNPACKED_DIR}/ /app/
COPY start.sh /app/start.sh
ENTRYPOINT ["/app/start.sh"]
EOF

docker build -t ${APP_NAME}:${IMAGE_TAG} .

echo "========================================================"
echo "Step 4: 导出 Docker 镜像为本地 tar 压缩包..."
echo "========================================================"

docker save ${APP_NAME}:${IMAGE_TAG} -o ${TAR_NAME}

echo "✅ 打包完成！已生成镜像归档文件: ${TAR_NAME}"
echo "👉 请执行以下命令传输至凝思工控机:"
echo "   scp ${TAR_NAME} semp@<工控机IP>:~/../"
