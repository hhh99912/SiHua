#!/bin/bash
# ==============================================================================
# 在打包编译机 (Ubuntu / 开发机) 上执行：
# 目标：构建出可在 老凝思系统 (GLIBC 2.24) 原生运行的 Electron 绿色免安装包
# ==============================================================================

set -e

echo "=== 步骤 1: 准备输出目录 ==="
rm -rf release dist dist-electron

echo "=== 步骤 2: 使用 Node 22 容器编译前端与打包 Electron 14 (避免宿主机环境污染) ==="
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

UNPACKED_DIR=$(find release -maxdepth 3 -type d -name "linux-unpacked" | head -n 1)

if [ -z "$UNPACKED_DIR" ]; then
    echo "[错误] 未找到 linux-unpacked 输出目录！"
    exit 1
fi

echo "=== 步骤 3: 注入凝思系统原生启动脚本 ==="
cat > "${UNPACKED_DIR}/run.sh" << 'EOF'
#!/bin/bash
# 进入脚本所在当前目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export LANG="C.UTF-8"
export LC_ALL="C.UTF-8"
export DISPLAY="${DISPLAY:-:0}"

# 解决输入法
export XMODIFIERS="@im=fcitx"
export GTK_IM_MODULE="fcitx"
export QT_IM_MODULE="fcitx"

APP_EXEC=$(find "$SCRIPT_DIR" -maxdepth 1 -type f -executable ! -name '*.so*' ! -name '*.sh' ! -name 'chrome*' | head -n 1)

if [ -z "$APP_EXEC" ]; then
    echo "[错误] 未找到可执行文件！"
    exit 1
fi

chmod +x "$APP_EXEC"

# 老凝思系统由于 Mesa/ANGLE 图形库版本老旧，默认开启硬件加速可能会产生 GL 0x0500 异常
# 这里提供稳定纯 CPU 软件渲染与安全模式
exec "$APP_EXEC" \
  --no-sandbox \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-gpu-rasterization \
  --disable-dev-shm-usage \
  --disable-gpu-sandbox \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --enable-font-antialiasing \
  --font-render-hinting=medium \
  --force-color-profile=srgb "$@"
EOF

chmod +x "${UNPACKED_DIR}/run.sh"

echo "=== 步骤 4: 打包为 tar.gz 压缩包方便传输至凝思 ==="
PACKAGE_NAME="ge-scada-linx-native.tar.gz"
tar -czf "$PACKAGE_NAME" -C release linux-unpacked

echo "========================================================"
echo "✅ 编译打包成功！生成文件: $PACKAGE_NAME"
echo "👉 传输步骤："
echo "   1. scp $PACKAGE_NAME semp@<凝思工控机IP>:~/"
echo "   2. 登录凝思工控机: tar -xzf $PACKAGE_NAME"
echo "   3. 启动应用: cd linux-unpacked && ./run.sh"
echo "========================================================"
