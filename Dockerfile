FROM ge-scada-env:latest

# 直接覆盖复制最新的 Linux 解包程序产物（仅需 1~2 秒）
COPY release/linux-unpacked/ /app/
RUN chmod +x /app/datav-scada-studio
