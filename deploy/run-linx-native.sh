#!/bin/bash
# ==============================================================================
# 凝思安全操作系统 (Linx OS 4.9.x) / Intel 2代核显 i915 / 96DPI VGA 屏幕
# 专治：文字发虚、图像模糊、锯齿 + 中文输入法 (Fcitx/IBus/搜狗拼音) 候选框不弹出问题
# ==============================================================================

# 进入脚本所在当前目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 确保图形与 X11 会话
export DISPLAY="${DISPLAY:-:0}"
xhost +local:root >/dev/null 2>&1 || true

# 2. 字符集智能配置：优先 zh_CN.UTF-8 确保输入法字符集完整无损传递
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

# 3. 中文输入法 (IME) 智能检测与 DBus 环境变量自动桥接
# 解决场景：以 root 身份或从终端启动时丢失 DBUS 会话导致输入法候选框弹不出的问题
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  USER_ID=$(id -u)
  if [ -e "/run/user/${USER_ID}/bus" ]; then
    export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${USER_ID}/bus"
  elif [ -e "/tmp/dbus-*" ]; then
    FOUND_DBUS=$(ls -t /tmp/dbus-* 2>/dev/null | head -n 1)
    [ -n "$FOUND_DBUS" ] && export DBUS_SESSION_BUS_ADDRESS="unix:path=${FOUND_DBUS}"
  fi
fi

DETECTED_IME=""
MANUAL_IME=""

# 扫描命令行参数是否手动指定 --ime
for arg in "$@"; do
  case "$arg" in
    --ime=*)
      MANUAL_IME="${arg#*=}"
      ;;
  esac
done

if [ -n "$MANUAL_IME" ]; then
  DETECTED_IME="$MANUAL_IME"
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

# 若未能检测到运行中的守护进程，默认采用凝思工控机主流的 fcitx
if [ -z "$DETECTED_IME" ]; then
  DETECTED_IME="fcitx"
fi

if [ "$DETECTED_IME" = "fcitx" ]; then
  export XMODIFIERS="@im=fcitx"
  export GTK_IM_MODULE="fcitx"
  export QT_IM_MODULE="fcitx"
  export CLUTTER_IM_MODULE="fcitx"
  export SDL_IM_MODULE="fcitx"
elif [ "$DETECTED_IME" = "ibus" ]; then
  export XMODIFIERS="@im=ibus"
  export GTK_IM_MODULE="ibus"
  export QT_IM_MODULE="ibus"
  export CLUTTER_IM_MODULE="ibus"
  export SDL_IM_MODULE="ibus"
  export IBUS_ENABLE_SYNC_MODE=1
else
  export XMODIFIERS="@im=${DETECTED_IME}"
  export GTK_IM_MODULE="${DETECTED_IME}"
  export QT_IM_MODULE="${DETECTED_IME}"
fi

# 4. 锁定 1:1 物理像素比与 FreeType 亚像素微调 (专治 1080p VGA 96DPI 发虚)
export GDK_SCALE=1
export GDK_DPI_SCALE=1
export SCADA_SCALE_FACTOR=1
export SCADA_FONT_HINTING=medium
export FREETYPE_PROPERTIES="truetype:interpreter-version=40 cff:no-stem-darkening=1 type1:no-stem-darkening=1 autofitter:warping=1"

# 5. 智能定位可执行主程序 (自动匹配 datav-scada-studio / ge-scada 等实际二进制)
APP_EXEC=$(find "$SCRIPT_DIR" -maxdepth 1 -type f -executable ! -name '*.so*' ! -name '*.sh' ! -name 'chrome*' | head -n 1)

if [ -z "$APP_EXEC" ]; then
  echo "[错误] 未找到可执行文件！请确认在 linux-unpacked 目录中执行。"
  exit 1
fi

chmod +x "$APP_EXEC"
TARGET_BIN="$APP_EXEC"

# 6. 参数处理与模式过滤
FILTERED_ARGS=()
ENABLE_DEBUG=0
ENABLE_FORCE_SOFT_GPU=0

for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    ENABLE_DEBUG=1
  elif [ "$arg" = "--disable-gpu" ] || [ "$arg" = "--soft-render" ] || [ "$arg" = "--cpu-render" ]; then
    ENABLE_FORCE_SOFT_GPU=1
  elif [[ "$arg" == --ime=* ]]; then
    continue
  else
    FILTERED_ARGS+=("$arg")
  fi
done

if [ "$ENABLE_DEBUG" = "1" ]; then
  export SCADA_DEBUG=1
  echo "[调试模式] 已通过 SCADA_DEBUG=1 激活 F12 开发者调试工具"
fi

# 7. 图形与渲染模式控制 (包含硬件视频解码与图层直通)
EXTRA_GPU_FLAGS=()
if [ "$ENABLE_FORCE_SOFT_GPU" = "1" ]; then
  echo "[图形渲染] 纯 CPU Skia 软件光栅化模式"
  EXTRA_GPU_FLAGS=(
    "--disable-gpu"
    "--disable-gpu-compositing"
    "--disable-gpu-rasterization"
  )
else
  echo "[图形渲染] 硬件视频解码加速 + Skia 2D 精准直出 (禁用 FBO 离屏重采样模糊)"
  EXTRA_GPU_FLAGS=(
    "--ignore-gpu-blocklist"
    "--enable-accelerated-video-decode"
    "--enable-features=VaapiVideoDecoder,PlatformHEVCDecoderSupport"
    "--use-cmd-decoder=validating"
    "--disable-features=CanvasOopRasterization,UseSkiaRendererByDefaultForOOPR"
    "--disable-gpu-rasterization"
    "--enable-zero-copy"
  )
fi

echo "============================================================"
echo " 正在启动 SCADA 工业大屏客户端 (凝思 Linux 专项优化)..."
echo " 目标程序: $TARGET_BIN"
echo " 输入法适配: $DETECTED_IME (已桥接 DBus 与 GTK3/X11)"
echo " 屏幕分辨率: 1920x1080 (96 DPI 1:1 物理像素点对点直显)"
echo " 字体微调: FreeType Medium Hinting + LCD 亚像素全微调"
echo " 显卡渲染: Intel 2代核显 i915 精准直显模式"
echo "============================================================"

# 8. 执行启动
exec "$TARGET_BIN" \
  --no-sandbox \
  --disable-gpu-sandbox \
  --disable-dev-shm-usage \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --font-render-hinting=medium \
  --enable-lcd-text \
  --enable-font-antialiasing \
  --force-color-profile=srgb \
  "${EXTRA_GPU_FLAGS[@]}" \
  "${FILTERED_ARGS[@]}"
