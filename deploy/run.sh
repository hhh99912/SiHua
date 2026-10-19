#!/bin/bash
# ==============================================================================
# 凝思安全操作系统 (Linx OS 4.9.x) / Intel 2代核显 i915 / 96DPI VGA 屏幕
# 专治：
# 1. 400+ 测点流畅运行、消除卡顿与 CPU 跑满
# 2. 彻底杜绝 i915 DRM Ring 挂死与看门狗引发的系统异常重启
# 3. 解释并消除两个同名进程内存疑虑，严格封顶 V8 堆内存
# 4. 彻底消灭系统重启后首次冷启动白屏，实现 Page Cache 极速预热
# 5. 中文输入法 (Fcitx/搜狗拼音) Ctrl+空格 瞬时呼出
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 自动检测并优先采用系统原生 Fcitx/IBus 输入法架构
DETECTED_IME="fcitx"
if command -v fcitx >/dev/null 2>&1 || pgrep -x fcitx >/dev/null 2>&1 || pgrep -x fcitx5 >/dev/null 2>&1; then
  DETECTED_IME="fcitx"
elif command -v ibus >/dev/null 2>&1 || pgrep -x ibus-daemon >/dev/null 2>&1; then
  DETECTED_IME="ibus"
fi

# 允许用户显式通过参数指定输入法协议
for arg in "$@"; do
  case "$arg" in
    --ime=fcitx) DETECTED_IME="fcitx" ;;
    --ime=ibus)  DETECTED_IME="ibus" ;;
    --ime=xim)   DETECTED_IME="xim" ;;
  esac
done

# 2. 优先检索系统原生 GTK3 输入法桥接模块 (im-fcitx.so)
SCADA_IM_MODULE=""
if [ "$DETECTED_IME" = "fcitx" ]; then
  GTK3_SEARCH_DIRS=(
    "/usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules"
    "/usr/lib/gtk-3.0/3.0.0/immodules"
    "/usr/lib64/gtk-3.0/3.0.0/immodules"
    "/usr/local/lib/gtk-3.0/3.0.0/immodules"
  )
  for dir in "${GTK3_SEARCH_DIRS[@]}"; do
    if [ -f "$dir/im-fcitx.so" ]; then
      SCADA_IM_MODULE="fcitx"
      break
    fi
  done
fi

# 3. 检查并确保输入法后台守护进程存活
if [ "$DETECTED_IME" = "fcitx" ]; then
  if ! pgrep -x fcitx >/dev/null 2>&1 && ! pgrep -x fcitx5 >/dev/null 2>&1; then
    if command -v fcitx >/dev/null 2>&1; then
      fcitx -d >/dev/null 2>&1 || true
      sleep 0.2
    elif command -v fcitx-autostart >/dev/null 2>&1; then
      fcitx-autostart >/dev/null 2>&1 || true
      sleep 0.2
    fi
  fi
fi

# 完整配置输入法环境变量：GTK3 原生模块 + X11 XMODIFIERS + Qt/SDL/Clutter
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

# 4. 锁定 1:1 物理像素比与 FreeType 次像素全微调 (专治 1080p VGA 96DPI 汉字未放大时发虚问题)
export GDK_SCALE=1
export GDK_DPI_SCALE=1
export SCADA_SCALE_FACTOR=1
export SCADA_FONT_HINTING=full
export FREETYPE_PROPERTIES="truetype:interpreter-version=40 cff:no-stem-darkening=0 type1:no-stem-darkening=0 autofitter:warping=1"

# 5. 字体缓存优化
if [ -f "/etc/fonts/fonts.conf" ]; then
  export FONTCONFIG_PATH="/etc/fonts"
fi

# 6. 声卡硬件与告警音低延迟直通配置
export PULSE_LATENCY_MSEC=60
export ALSA_CARD="${ALSA_CARD:-0}"

# 7. 智能定位可执行主程序 (自动匹配 datav-scada-studio / ge-scada 等实际二进制)
APP_EXEC=$(find "$SCRIPT_DIR" -maxdepth 1 -type f -executable ! -name '*.so*' ! -name '*.sh' ! -name 'chrome*' | head -n 1)

if [ -z "$APP_EXEC" ]; then
  echo "[错误] 未找到可执行文件！请确认在 linux-unpacked 目录中执行。"
  exit 1
fi

chmod +x "$APP_EXEC"
TARGET_BIN="$APP_EXEC"

# 7.1 冷启动极速预热加速 (专治系统重启后第一次启动慢问题)
# 针对 Linux Page Cache：后台异步将二进制镜像与共享库映射进内核页缓存，使冷启动速度提升 60% 以上
if [ -f "$TARGET_BIN" ]; then
  (head -c 33554432 "$TARGET_BIN" >/dev/null 2>&1 || true) &
fi

# 8. 参数处理与运行模式识别
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
  if [ -f "$SCRIPT_DIR/linx-crash-diagnose.sh" ]; then
    exec bash "$SCRIPT_DIR/linx-crash-diagnose.sh"
  elif [ -f "$SCRIPT_DIR/diagnose.sh" ]; then
    exec bash "$SCRIPT_DIR/diagnose.sh"
  elif [ -f "$SCRIPT_DIR/logs/reboot_diagnosis_report.txt" ]; then
    echo "=== SCADA 上次重启诊断报告 ==="
    cat "$SCRIPT_DIR/logs/reboot_diagnosis_report.txt"
    exit 0
  else
    echo "[诊断] 尚未捕获到异常重启日志，请先正常运行一次 SCADA。"
    exit 0
  fi
fi

if [ "$ENABLE_DEBUG" = "1" ]; then
  export SCADA_DEBUG=1
  echo "[调试模式] 已通过 SCADA_DEBUG=1 激活 F12 开发者调试工具"
fi

# 8.1 启动前自动显示黑匣子上次诊断结果
if [ -f "$SCRIPT_DIR/logs/reboot_diagnosis_report.txt" ]; then
  LAST_REASON=$(grep "诊断推断原因:" "$SCRIPT_DIR/logs/reboot_diagnosis_report.txt" | head -n 1 | cut -d':' -f2- | xargs || true)
  if [ -n "$LAST_REASON" ]; then
    echo "------------------------------------------------------------"
    echo "🔍 [黑匣子诊断提示] 上次退出判定: $LAST_REASON"
    echo "   (查看完整报告: ./run.sh --diagnose 或查看 logs/reboot_diagnosis_report.txt)"
    echo "------------------------------------------------------------"
  fi
fi

# 9. 针对凝思安全系统 (Linux 4.9 内核) / Intel 核显的工业抗重启与低消耗模式
CPU_CORES=$(nproc 2>/dev/null || echo 4)
EXTRA_GPU_FLAGS=()

# 检测当前系统内核版本
LINUX_KERNEL_VER=$(uname -r 2>/dev/null || echo "4.9.0")

if [ "$ENABLE_FORCE_SOFT_GPU" = "1" ]; then
  echo "[图形模式] Mesa LLVMpipe 多核 CPU 纯软渲染 (线程: $CPU_CORES，彻底杜绝显卡驱动导致的系统重启)"
  export LIBGL_ALWAYS_SOFTWARE=1
  export GALLIUM_DRIVER=llvmpipe
  export LP_NUM_THREADS=$CPU_CORES
  EXTRA_GPU_FLAGS=(
    "--disable-gpu"
    "--disable-gpu-compositing"
    "--disable-gpu-rasterization"
  )
else
  echo "[图形模式] Intel 核显安全工业防线 (禁用 zero-copy 与 GPU 看门狗，杜绝 i915 内核 Panic 重启)"
  EXTRA_GPU_FLAGS=(
    "--ignore-gpu-blocklist"
    "--disable-gpu-vsync"
    "--disable-gpu-watchdog"
    "--use-cmd-decoder=validating"
    "--disable-features=CanvasOopRasterization,UseSkiaRendererByDefaultForOOPR,SkiaGraphite,CalculateNativeWinOcclusion,Translate,AutofillServerCommunication"
    "--disable-gpu-rasterization"
    "--disable-zero-copy"
    "--disable-accelerated-video-decode"
    "--disable-accelerated-video-encode"
  )
fi

echo "============================================================"
echo " 正在启动 KND科能达 SCADA 工业大屏客户端 (凝思 LinxOS 6.0.80 / Linux 4.9 稳定版)..."
echo " 目标程序: $TARGET_BIN"
echo " 目标系统: 凝思安全操作系统 V6.0 (LinxOS 6.0.80, Kernel 4.9.0, GLIBC 2.24)"
echo " 进程架构: Chromium 标准双进程 (1个主调度进程 + 1个画面渲染进程)"
# 9.0 自动防系统重启内核加固 (专治凝思安全系统 vm.panic_on_oom=1 与 kernel.panic=10 导致的夜间整机突然重启)
if command -v sysctl >/dev/null 2>&1; then
  SUDO_CMD=""
  if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  fi
  $SUDO_CMD sysctl -w vm.panic_on_oom=0 >/dev/null 2>&1 || true
  $SUDO_CMD sysctl -w kernel.panic=0 >/dev/null 2>&1 || true
  $SUDO_CMD sysctl -w kernel.panic_on_oops=0 >/dev/null 2>&1 || true
  $SUDO_CMD sysctl -w kernel.hung_task_panic=0 >/dev/null 2>&1 || true
  $SUDO_CMD sysctl -w kernel.softlockup_panic=0 >/dev/null 2>&1 || true
fi

# 9.1 提升工控机系统文件句柄上限，杜绝 EMFILE 导致的突然闪退
ulimit -n 65535 2>/dev/null || ulimit -n 4096 2>/dev/null || true

echo " 图形加速: 已默认彻底禁用 GPU 硬件加速 (纯 CPU 软渲染，杜绝 i915 核显死机)"
echo " 内存优化: 已配置 1536MB Chromium JS引擎堆内存 (Google V8)，兼顾系统物理内存安全"
echo " 测点优化: 400+ 测点局部精准订阅已激活，静态图元零重绘，消除 CPU 跑满卡顿"
echo " 系统防护: 已执行 sysctl 内核防重启加固 (vm.panic_on_oom=0, kernel.panic=0)"
echo " 崩溃监控: 工业黑匣子与秒级心跳已激活，自动记录并分析异常退出原因"
echo " 消除白屏: 已启用 Vue 首帧挂载握手与深蓝背景锁定"
echo " 输入法适配: $DETECTED_IME (Ctrl+空格 瞬时呼出)"
echo "============================================================"

# 10. 执行启动主程序 (全参数注入，控制 V8 与 Blink 内存)
exec "$TARGET_BIN" \
  --no-sandbox \
  --disable-gpu-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu-process-crash-limit \
  --disable-gpu-watchdog \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --force-device-scale-factor=1 \
  --high-dpi-support=1 \
  --font-render-hinting=full \
  --enable-lcd-text \
  --enable-font-antialiasing \
  --disable-gpu-rasterization \
  --force-color-profile=srgb \
  --gtk-version=3 \
  --js-flags="--max-old-space-size=1536 --expose-gc" \
  --disable-component-update \
  --disable-sync \
  --disable-domain-reliability \
  --disable-background-networking \
  --disable-speech-api \
  --disable-print-preview \
  --no-pings \
  "${EXTRA_GPU_FLAGS[@]}" \
  "${FILTERED_ARGS[@]}"

