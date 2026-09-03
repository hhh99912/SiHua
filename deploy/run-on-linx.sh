#!/bin/bash
# ==============================================================================
# 在 凝思工控机 (Linx OS 4.9.x) 上执行：启动 SCADA 工业大屏 GUI 容器
# ==============================================================================

export DISPLAY=:0
xhost +local:root >/dev/null 2>&1

# 1. 弹出轻量 Splash 启动提示
(
  xmessage -center -buttons "" -timeout 5 \
    " GE-SCADA 工业大屏正在启动，请稍候... " 2>/dev/null
) &
SPLASH_PID=$!

CONTAINER_NAME="ge-scada-instance"
IMAGE_NAME="ge-scada-app:latest"

# 2. 检查并拉起容器
CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' $CONTAINER_NAME 2>/dev/null)

if [ "$CONTAINER_STATUS" = "exited" ] || [ "$CONTAINER_STATUS" = "created" ]; then
    echo "启动已有容器..."
    docker start $CONTAINER_NAME >/dev/null 2>&1
else
    echo "创建并运行全新大屏容器..."
    docker rm -f $CONTAINER_NAME >/dev/null 2>&1 || true
    
    CPU_CORES=$(nproc 2>/dev/null || echo 4)

    docker run -d \
      --name $CONTAINER_NAME \
      --restart unless-stopped \
      --net=host \
      --ipc=host \
      --shm-size=2gb \
      -e DISPLAY=:0 \
      -v /tmp/.X11-unix:/tmp/.X11-unix \
      -v /dev/dri:/dev/dri \
      -v /run/dbus/system_bus_socket:/run/dbus/system_bus_socket \
      -v /var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket \
      `# --- 1. 声卡硬件映射（告警音） ---` \
      --device /dev/snd \
      --group-add audio \
      `# --- 2. Fcitx 中文输入法通信通道 ---` \
      -e XMODIFIERS="@im=fcitx" \
      -e GTK_IM_MODULE="fcitx" \
      -e QT_IM_MODULE="fcitx" \
      -v /tmp:/tmp \
      `# --- 3. Mesa 多核软渲染与清晰度环境变量 ---` \
      -e LIBGL_ALWAYS_SOFTWARE=1 \
      -e GALLIUM_DRIVER=llvmpipe \
      -e LP_NUM_THREADS=$CPU_CORES \
      -e GDK_SCALE=1 \
      -e GDK_DPI_SCALE=1 \
      -e FREETYPE_PROPERTIES="truetype:interpreter-version=40 cff:no-stem-darkening=0 type1:no-stem-darkening=0" \
      --privileged \
      ${IMAGE_NAME} >/dev/null 2>&1
fi

# 3. 窗口弹出后自动关闭提示框
for i in $(seq 1 40); do
    if xdotool search --name ".*" 2>/dev/null | grep -q .; then
        break
    fi
    sleep 0.1
done

kill $SPLASH_PID 2>/dev/null || true

echo "✅ SCADA 大屏客户端已在凝思系统屏幕上启动成功！"
