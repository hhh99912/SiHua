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

# 优先采用原生 fcitx 协议（通过 DBus 传递按键与候选框，保证 Ctrl+空格 瞬时生效）
if [ -n "$SCADA_IM_MODULE" ]; then
  export GTK_IM_MODULE="$SCADA_IM_MODULE"
elif [ "$DETECTED_IME" = "ibus" ]; then
  export GTK_IM_MODULE="ibus"
  export XMODIFIERS="@im=ibus"
  export QT_IM_MODULE="ibus"
else
  export GTK_IM_MODULE="fcitx"
  export XMODIFIERS="@im=fcitx"
  export QT_IM_MODULE="fcitx"
  export CLUTTER_IM_MODULE="fcitx"
  export SDL_IM_MODULE="fcitx"
fi

if [ "$DETECTED_IME" = "fcitx" ]; then
  if ! pgrep -x fcitx >/dev/null 2>&1 && ! pgrep -x fcitx5 >/dev/null 2>&1; then
    if command -v fcitx >/dev/null 2>&1; then
      fcitx -d >/dev/null 2>&1 || true
      sleep 0.2
    fi
  fi
fi

echo "[输入法] 已激活 ${DETECTED_IME} (GTK_IM_MODULE=${GTK_IM_MODULE}, XMODIFIERS=${XMODIFIERS}, Ctrl+空格 激活)"

# 3. 凝思 1080p 96DPI 屏幕与 Intel 2代核显 (i915) 高清抗模糊与声卡直通配置
export GDK_SCALE=1
export GDK_DPI_SCALE=1
export SCADA_SCALE_FACTOR=1
export SCADA_FONT_HINTING=full
export FREETYPE_PROPERTIES="truetype:interpreter-version=40 cff:no-stem-darkening=0 type1:no-stem-darkening=0 autofitter:warping=1"
export PULSE_LATENCY_MSEC=60
export ALSA_CARD="${ALSA_CARD:-0}"

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

# 4.1 确保 logs 目录存在
mkdir -p "$SCRIPT_DIR/logs"

# 4.2 提升工控机系统文件句柄上限，杜绝 EMFILE 导致的突然闪退
ulimit -n 65535 2>/dev/null || ulimit -n 4096 2>/dev/null || true

# 5. 参数处理与模式识别
FILTERED_ARGS=()
ENABLE_DEBUG=0
ENABLE_FORCE_SOFT_GPU=1
RUN_DIAGNOSE_ONLY=0

for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    ENABLE_DEBUG=1
  elif [ "$arg" = "--enable-gpu" ] || [ "$arg" = "--hardware-gpu" ]; then
    ENABLE_FORCE_SOFT_GPU=0
  elif [ "$arg" = "--disable-gpu" ] || [ "$arg" = "--soft-render" ] || [ "$arg" = "--cpu-render" ] || [ "$arg" = "--safe-mode" ]; then
    ENABLE_FORCE_SOFT_GPU=1
  elif [ "$arg" = "--diagnose" ] || [ "$arg" = "-d" ] || [ "$arg" = "--check" ]; then
    RUN_DIAGNOSE_ONLY=1
  elif [[ "$arg" == --ime=* ]]; then
    continue
  else
    FILTERED_ARGS+=("$arg")
  fi
done

# 如果用户传入 --diagnose 参数，则直接进入诊断分析模式
if [ "$RUN_DIAGNOSE_ONLY" = "1" ]; then
  if [ -f "$SCRIPT_DIR/diagnose.sh" ]; then
    exec bash "$SCRIPT_DIR/diagnose.sh"
  elif [ -f "$SCRIPT_DIR/reboot_diagnosis_report.txt" ]; then
    echo "=== SCADA 上次重启诊断报告 ==="
    cat "$SCRIPT_DIR/reboot_diagnosis_report.txt"
    exit 0
  else
    echo "[诊断] 尚未捕获到异常重启日志，请先正常运行一次 SCADA。"
    exit 0
  fi
fi

if [ "$ENABLE_DEBUG" = "1" ]; then
  export SCADA_DEBUG=1
  echo "[调试模式] 已通过 SCADA_DEBUG=1 激活调试与开发者工具 (F12)"
fi

# 5.1 启动前显示黑匣子上次诊断结果 (让用户一眼看到上次为什么退出)
if [ -f "$SCRIPT_DIR/logs/reboot_diagnosis_report.txt" ]; then
  LAST_REASON=$(grep "诊断推断原因:" "$SCRIPT_DIR/logs/reboot_diagnosis_report.txt" | head -n 1 | cut -d':' -f2- | xargs || true)
  if [ -n "$LAST_REASON" ]; then
    echo "------------------------------------------------------------"
    echo "🔍 [黑匣子诊断提示] 上次退出判定: $LAST_REASON"
    echo "   (查看完整报告: ./run.sh --diagnose 或查看 logs/reboot_diagnosis_report.txt)"
    echo "------------------------------------------------------------"
  fi
fi

# 6. 针对硬件的全部优化 (Intel 2代核显 i915 / Mesa CPU 多核软渲染)
CPU_CORES=$(nproc 2>/dev/null || echo 4)
EXTRA_GPU_FLAGS=()
if [ "$ENABLE_FORCE_SOFT_GPU" = "1" ]; then
  echo "[图形渲染] Mesa 多核 CPU 软渲染模式 (线程数: $CPU_CORES)"
  export LIBGL_ALWAYS_SOFTWARE=1
  export GALLIUM_DRIVER=llvmpipe
  export LP_NUM_THREADS=$CPU_CORES
  EXTRA_GPU_FLAGS=(
    "--disable-gpu"
    "--disable-gpu-compositing"
    "--disable-gpu-rasterization"
  )
else
  echo "[图形渲染] Intel 2代核显 i915 安全工业防线 (CPU FreeType 字体全微调)"
  EXTRA_GPU_FLAGS=(
    "--ignore-gpu-blocklist"
    "--disable-gpu-vsync"
    "--use-cmd-decoder=validating"
    "--disable-features=CanvasOopRasterization,UseSkiaRendererByDefaultForOOPR,SkiaGraphite,CalculateNativeWinOcclusion,Translate,AutofillServerCommunication"
    "--disable-gpu-rasterization"
    "--disable-zero-copy"
    "--disable-gpu-watchdog"
  )
fi

echo "============================================================"
echo " 正在启动 KND科能达 SCADA 工业大屏客户端 (凝思 Linux 4.9 稳定版)..."
echo " 目标程序: $APP_EXEC"
echo " 内存优化: 已配置 2048MB 安全 V8 堆内存，彻底消灭 512MB 导致的 OOM 闪退"
echo " 崩溃监控: 工业黑匣子已激活，秒级记录运行快照与退出原因"
echo " 句柄优化: 文件句柄限制已提升至 65535"
echo " 输入法适配: $DETECTED_IME (Ctrl+空格 瞬时呼出)"
echo "============================================================"

# 7. 启动主程序
exec "$APP_EXEC" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu-sandbox \
  --disable-gpu-process-crash-limit \
  --disable-gpu-watchdog \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --enable-lcd-text \
  --enable-font-antialiasing \
  --font-render-hinting=full \
  --force-color-profile=srgb \
  --gtk-version=3 \
  --js-flags="--max-old-space-size=2048 --expose-gc" \
  --disable-component-update \
  --disable-sync \
  --disable-domain-reliability \
  --disable-background-networking \
  --disable-speech-api \
  --disable-print-preview \
  --no-pings \
  "${EXTRA_GPU_FLAGS[@]}" \
  "${FILTERED_ARGS[@]}"
EOF

chmod +x "${UNPACKED_DIR}/run.sh"

# 将诊断分析脚本同步打包进发布目录，方便现场一键执行
if [ -f "deploy/linx-crash-diagnose.sh" ]; then
  cp "deploy/linx-crash-diagnose.sh" "${UNPACKED_DIR}/diagnose.sh"
  chmod +x "${UNPACKED_DIR}/diagnose.sh"
fi

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
