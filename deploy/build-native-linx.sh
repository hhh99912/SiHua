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

echo "=== 步骤 3: 注入凝思系统原生启动脚本 (智能输入法适配 + 极清渲染优化) ==="
cat > "${UNPACKED_DIR}/run.sh" << 'EOF'
#!/bin/bash
# ==============================================================================
# 凝思安全操作系统 (Linx OS 4.9.x) / Intel 核显 / 工业 SCADA 原生启动脚本
# 特性：
# 1. 中文输入法智能检测与 DBus 自动桥接 (支持 Fcitx / Fcitx5 / IBus / 搜狗拼音 / 极点五笔)
# 2. 1080p VGA 96DPI 像素级抗模糊 (解决 Intel 2代核显 i915 发虚、锯齿问题)
# 3. 规避窗口最小化卡死与后台节流
# ==============================================================================

# 进入脚本所在当前目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 基础图形与字符集环境配置
export DISPLAY="${DISPLAY:-:0}"
xhost +local:root >/dev/null 2>&1 || true

# 字符集智能设置：优先使用 zh_CN.UTF-8 确保输入法字符集与剪贴板完全兼容
if locale -a 2>/dev/null | grep -qi "zh_CN.utf"; then
  export LANG="zh_CN.UTF-8"
  export LC_ALL="zh_CN.UTF-8"
  export LC_CTYPE="zh_CN.UTF-8"
elif locale -a 2>/dev/null | grep -qi "C.utf"; then
  export LANG="C.UTF-8"
  export LC_ALL="C.UTF-8"
  export LC_CTYPE="C.UTF-8"
else
  export LANG="${LANG:-C.UTF-8}"
  export LC_ALL="${LC_ALL:-C.UTF-8}"
  export LC_CTYPE="${LC_CTYPE:-C.UTF-8}"
fi

# 2. 中文输入法 (IME) 智能检测与 DBus 环境变量桥接
# 解决场景：以 root 身份或从终端启动时丢失 DBUS 会话导致输入法候选框弹不出的问题
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  # 尝试从用户会话或系统中寻回 DBus Session Bus
  USER_ID=$(id -u)
  if [ -e "/run/user/${USER_ID}/bus" ]; then
    export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${USER_ID}/bus"
  elif [ -e "/tmp/dbus-*" ]; then
    FOUND_DBUS=$(ls -t /tmp/dbus-* 2>/dev/null | head -n 1)
    [ -n "$FOUND_DBUS" ] && export DBUS_SESSION_BUS_ADDRESS="unix:path=${FOUND_DBUS}"
  fi
fi

# 智能识别当前运行的输入法守护进程 (Fcitx / IBus / XIM)
DETECTED_IME=""
MANUAL_IME=""

# 预先扫描命令行参数是否有指定 --ime=fcitx 或 --ime=ibus
for arg in "$@"; do
  case "$arg" in
    --ime=*)
      MANUAL_IME="${arg#*=}"
      ;;
  esac
done

if [ -n "$MANUAL_IME" ]; then
  DETECTED_IME="$MANUAL_IME"
  echo "[输入法] 用户手动指定输入法框架: $DETECTED_IME"
elif pgrep -x fcitx >/dev/null 2>&1 || pgrep -x fcitx5 >/dev/null 2>&1 || pgrep -f sogou-qimpanel >/dev/null 2>&1; then
  DETECTED_IME="fcitx"
elif pgrep -x ibus-daemon >/dev/null 2>&1 || pgrep -f ibus >/dev/null 2>&1; then
  DETECTED_IME="ibus"
elif [ -n "$XMODIFIERS" ]; then
  if [[ "$XMODIFIERS" =~ fcitx ]]; then
    DETECTED_IME="fcitx"
  elif [[ "$XMODIFIERS" =~ ibus ]]; then
    DETECTED_IME="ibus"
  fi
fi

# 若未能检测到任何运行中的输入法，默认采用凝思/国产系统普及率最高的 fcitx
if [ -z "$DETECTED_IME" ]; then
  DETECTED_IME="fcitx"
fi

if [ "$DETECTED_IME" = "fcitx" ]; then
  export XMODIFIERS="@im=fcitx"
  export GTK_IM_MODULE="fcitx"
  export QT_IM_MODULE="fcitx"
  export CLUTTER_IM_MODULE="fcitx"
  export SDL_IM_MODULE="fcitx"
  echo "[输入法] 已激活 Fcitx / 搜狗拼音输入法适配 (GTK3 / X11 协议已就绪)"
elif [ "$DETECTED_IME" = "ibus" ]; then
  export XMODIFIERS="@im=ibus"
  export GTK_IM_MODULE="ibus"
  export QT_IM_MODULE="ibus"
  export CLUTTER_IM_MODULE="ibus"
  export SDL_IM_MODULE="ibus"
  export IBUS_ENABLE_SYNC_MODE=1
  echo "[输入法] 已激活 IBus 智能输入法适配 (GTK3 / X11 协议已就绪)"
else
  export XMODIFIERS="@im=${DETECTED_IME}"
  export GTK_IM_MODULE="${DETECTED_IME}"
  export QT_IM_MODULE="${DETECTED_IME}"
  echo "[输入法] 启用系统输入法: ${DETECTED_IME}"
fi

# 3. 凝思 1080p 96DPI 屏幕与 Intel 2代核显 (i915) 高清抗模糊配置
export GDK_SCALE=1
export GDK_DPI_SCALE=1
export SCADA_SCALE_FACTOR=1
export SCADA_FONT_HINTING=medium
export FREETYPE_PROPERTIES="truetype:interpreter-version=40 cff:no-stem-darkening=1 type1:no-stem-darkening=1 autofitter:warping=1"

# 4. 自动识别定位可执行主程序 (如 datav-scada-studio)
APP_EXEC=$(find "$SCRIPT_DIR" -maxdepth 1 -type f -executable ! -name '*.so*' ! -name '*.sh' ! -name '*.bin' ! -name '*.pak' ! -name 'chrome*' | head -n 1)

if [ -z "$APP_EXEC" ]; then
    APP_EXEC=$(find "$SCRIPT_DIR" -maxdepth 1 -type f -executable ! -name '*.so*' ! -name '*.sh' ! -name 'chrome*' | head -n 1)
fi

if [ -z "$APP_EXEC" ]; then
    echo "[错误] 未找到可执行文件！请确认在 linux-unpacked 目录下执行。"
    exit 1
fi

chmod +x "$APP_EXEC"

# 5. 参数处理与模式识别
FILTERED_ARGS=()
ENABLE_DEBUG=0
ENABLE_FORCE_SOFT_GPU=0

for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    ENABLE_DEBUG=1
  elif [ "$arg" = "--disable-gpu" ] || [ "$arg" = "--soft-render" ] || [ "$arg" = "--cpu-render" ]; then
    ENABLE_FORCE_SOFT_GPU=1
  elif [[ "$arg" == --ime=* ]]; then
    # 忽略 --ime 参数，已在上方处理
    continue
  else
    FILTERED_ARGS+=("$arg")
  fi
done

if [ "$ENABLE_DEBUG" = "1" ]; then
  export SCADA_DEBUG=1
  echo "[调试模式] 已通过 SCADA_DEBUG=1 激活调试与开发者工具 (F12)"
fi

# 6. 图形与光栅化渲染控制
EXTRA_GPU_FLAGS=()
if [ "$ENABLE_FORCE_SOFT_GPU" = "1" ]; then
  echo "[图形渲染] 纯 CPU Skia 软件光栅化模式 (彻底消除老旧显卡硬件滤波模糊)"
  EXTRA_GPU_FLAGS=(
    "--disable-gpu"
    "--disable-gpu-compositing"
    "--disable-gpu-rasterization"
  )
else
  echo "[图形渲染] 硬件加速 + Skia 2D 精准直出 (禁用 FBO 双线性模糊过滤)"
  EXTRA_GPU_FLAGS=(
    "--use-cmd-decoder=validating"
    "--disable-features=CanvasOopRasterization,UseSkiaRendererByDefaultForOOPR"
    "--disable-gpu-rasterization"
    "--enable-zero-copy"
  )
fi

# 7. 启动主程序
exec "$APP_EXEC" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu-sandbox \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --enable-lcd-text \
  --enable-font-antialiasing \
  --font-render-hinting=medium \
  --force-color-profile=srgb \
  "${EXTRA_GPU_FLAGS[@]}" \
  "${FILTERED_ARGS[@]}"
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
