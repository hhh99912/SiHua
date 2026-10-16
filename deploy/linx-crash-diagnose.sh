#!/bin/bash
# ==============================================================================
# 凝思安全操作系统 (Linx OS 4.9.x) / 工控机 突然重启/闪退 自动化深度诊断分析工具
# 适配内核: Linux 4.9.0-8-linx-security-amd64 #1 SMP Linx 4.9.130-2linx9
# 用途：
# 1. 精准提取内核崩溃记录 (Kernel Panic, Oops, MCE 硬件异常)
# 2. 诊断是否发生 Linux OOM-Killer 或物理内存枯竭
# 3. 检查工控机硬件看门狗 (Hardware Watchdog /dev/watchdog) 超时复位
# 4. 分析 SCADA 工业黑匣子与上次异常中断时的瞬时现场
# 5. 一键生成针对凝思工控机的内核防重启加固配置
# ==============================================================================

set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_OUTPUT="/tmp/linx_scada_crash_analysis_$(date +%Y%m%d_%H%M%S).txt"

echo -e "${CYAN}${BOLD}"
echo "=============================================================================="
echo "    凝思安全系统 (Linx OS 4.9.x) SCADA 突然重启原因深度诊断与排查工具       "
echo "=============================================================================="
echo -e "${NC}"

echo -e "[*] 正在采集当前系统运行特征..."
echo -e "    主机名称: $(hostname 2>/dev/null || echo 'Unknown')"
echo -e "    内核版本: $(uname -a)"
echo -e "    当前时间: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo -e "    系统开机时长: $(uptime 2>/dev/null || echo 'N/A')"
echo ""

exec > >(tee -a "$REPORT_OUTPUT")
exec 2>&1

echo "=============================================================================="
echo " 1. 系统重启与关机历史分析 (Reboot & Shutdown History)"
echo "=============================================================================="
echo -e "[*] 最近 5 次系统开机/重启记录:"
if command -v last >/dev/null 2>&1; then
    last reboot -n 5 2>/dev/null || last -n 5 2>/dev/null
    echo ""
    echo -e "[*] 检查是否有异常突然断电或无前兆重启 (crash 标记):"
    last -x 2>/dev/null | grep -E "reboot|shutdown|crash" | head -n 8 || true
else
    echo "    (系统未安装 last 工具，跳过)"
fi
echo ""

echo "=============================================================================="
echo " 2. Linux 内核 Panic / Oops / 严重崩溃日志检索"
echo "=============================================================================="
FOUND_KERNEL_PANIC=0

SEARCH_LOG_FILES=(
    "/var/log/messages"
    "/var/log/syslog"
    "/var/log/kern.log"
    "/var/log/messages.1"
    "/var/log/syslog.1"
)

echo -e "[*] 正在检索内核崩溃关键词 (Kernel panic, Oops, BUG, MCE)..."
for log_file in "${SEARCH_LOG_FILES[@]}"; do
    if [ -f "$log_file" ] && [ -r "$log_file" ]; then
        MATCH_COUNT=$(grep -i -c -E "kernel panic|oops:|BUG: unable to handle|Machine check exception" "$log_file" 2>/dev/null || echo "0")
        MATCH_COUNT=${MATCH_COUNT:-0}
        if [ "$MATCH_COUNT" -gt 0 ] 2>/dev/null; then
            FOUND_KERNEL_PANIC=1
            echo -e "${RED}[发现严重记录] 在 $log_file 中检索到 $MATCH_COUNT 条内核崩溃关键词：${NC}"
            grep -i -E "kernel panic|oops:|BUG: unable to handle|Machine check exception" "$log_file" | tail -n 10
            echo "------------------------------------------------------------------------"
        fi
    fi
done

if [ -d "/sys/fs/pstore" ]; then
    PSTORE_FILES=$(ls -A /sys/fs/pstore 2>/dev/null || true)
    if [ -n "$PSTORE_FILES" ]; then
        echo -e "${YELLOW}[发现硬件灾难转储] /sys/fs/pstore 存在持久化崩溃转储:${NC}"
        ls -la /sys/fs/pstore
        FOUND_KERNEL_PANIC=1
    fi
fi

if [ "$FOUND_KERNEL_PANIC" -eq 0 ]; then
    echo -e "${GREEN}[正常] 未检索到明显的 Linux 内核 Panic 或 Oops 日志。${NC}"
fi
echo ""

echo "=============================================================================="
echo " 3. Linux OOM-Killer (物理内存枯竭杀死进程) 诊断"
echo "=============================================================================="
FOUND_OOM=0

echo -e "[*] 检查 dmesg 与系统日志中的 Out of memory 记录:"
if dmesg 2>/dev/null | grep -i -E "out of memory|oom-killer|killed process" >/dev/null 2>&1; then
    FOUND_OOM=1
    echo -e "${RED}[发现 OOM 记录] dmesg 缓存中检测到 OOM-Killer 激活：${NC}"
    dmesg | grep -i -E "out of memory|oom-killer|killed process" | tail -n 10
    echo ""
fi

for log_file in "${SEARCH_LOG_FILES[@]}"; do
    if [ -f "$log_file" ] && [ -r "$log_file" ]; then
        OOM_COUNT=$(grep -i -c -E "invoked oom-killer|out of memory: kill" "$log_file" 2>/dev/null || echo "0")
        OOM_COUNT=${OOM_COUNT:-0}
        if [ "$OOM_COUNT" -gt 0 ] 2>/dev/null; then
            FOUND_OOM=1
            echo -e "${RED}[发现 OOM 记录] 在 $log_file 中检索到 $OOM_COUNT 条 OOM-Killer 记录：${NC}"
            grep -i -E "invoked oom-killer|out of memory: kill" "$log_file" | tail -n 6
            echo "------------------------------------------------------------------------"
        fi
    fi
done

if [ "$FOUND_OOM" -eq 0 ]; then
    echo -e "${GREEN}[正常] 系统日志中未发现 Linux OOM-Killer 杀进程迹象。${NC}"
fi
echo ""

echo "=============================================================================="
echo " 4. 工控机硬件看门狗 (Hardware Watchdog) 设备与守护状态排查"
echo "=============================================================================="
WATCHDOG_DEV_FOUND=0

if [ -e "/dev/watchdog" ] || [ -e "/dev/watchdog0" ] || [ -e "/dev/watchdog1" ]; then
    WATCHDOG_DEV_FOUND=1
    echo -e "${YELLOW}[注意] 检测到硬件看门狗设备节点存在: /dev/watchdog*${NC}"
    ls -l /dev/watchdog* 2>/dev/null || true
    
    echo -e "[*] 正在检索看门狗内核驱动模块:"
    lsmod 2>/dev/null | grep -i -E "wdt|watchdog|itco|sp5100|fintek|ite" || echo "    (未见典型外置模块，可能已静态编译进 Linx 4.9 内核)"

    echo -e "[*] 正在检查是否有看门狗用户态守护进程:"
    ps aux 2>/dev/null | grep -E "watchdog|wd_keepalive" | grep -v grep || echo "    (当前未运行用户态 watchdog 守护程序)"
    
    echo -e "[*] 检索 dmesg 中看门狗动作记录:"
    dmesg 2>/dev/null | grep -i -E "watchdog|wdt|iTCO" | tail -n 6 || true

    echo -e "[*] 检查 /etc/watchdog.conf 看门狗复位配置文件 (关键排查点):"
    if [ -f "/etc/watchdog.conf" ]; then
        grep -v '^[[:space:]]*#' /etc/watchdog.conf | grep -v '^[[:space:]]*$' || echo "    (配置为空或全部被注释)"
    else
        echo "    (/etc/watchdog.conf 不存在)"
    fi

    echo -e "[*] 检查是否存在 systemd 服务配置了 FailureAction=reboot 或 WatchdogSec:"
    grep -rn -E "FailureAction=reboot|WatchdogSec|OnFailure=.*reboot" /etc/systemd/system/ /lib/systemd/system/ 2>/dev/null | head -n 10 || echo "    (未检测到 systemd 故障自动重启配置)"

    echo -e "[*] 检查系统核心转储 (Core Dump / SIGSEGV) 记录 (排查 C++ 后端是否段错误崩溃):"
    ls -la /var/crash/ /tmp/core* core* 2>/dev/null || echo "    (未发现明显 core dump 文件)"
else
    echo -e "${GREEN}[正常] 未挂载 /dev/watchdog 设备节点，硬件芯片级看门狗未启用。${NC}"
fi
echo ""

echo "=============================================================================="
echo " 5. 凝思安全操作系统 (Linx 9) 关键防重启内核参数核验"
echo "=============================================================================="
echo -e "[*] 检查凝思安全内核对崩溃与内存溢出的处置策略 (sysctl):"

check_sysctl_param() {
    local param="$1"
    local desc="$2"
    local val
    val=$(sysctl -n "$param" 2>/dev/null || echo "N/A")
    printf "    %-26s = %-8s (%s)\n" "$param" "$val" "$desc"
}

check_sysctl_param "vm.panic_on_oom" "1=内存耗尽直接触发整机重启; 0=仅杀进程"
check_sysctl_param "kernel.panic" "崩溃后重启倒计时秒数, 0=不重启卡死现场"
check_sysctl_param "kernel.panic_on_oops" "1=驱动oops直接整机重启; 0=尝试恢复"
check_sysctl_param "kernel.hung_task_panic" "1=任务挂死直接重启"
check_sysctl_param "kernel.softlockup_panic" "1=CPU软锁死直接重启"
check_sysctl_param "fs.file-max" "系统最大文件句柄上限"

PANIC_ON_OOM=$(sysctl -n vm.panic_on_oom 2>/dev/null || echo 0)
KERNEL_PANIC=$(sysctl -n kernel.panic 2>/dev/null || echo 0)

if [ "$PANIC_ON_OOM" = "1" ] || [ "$PANIC_ON_OOM" = "2" ]; then
    echo -e "${RED}[极高风险警告] vm.panic_on_oom 设置为 $PANIC_ON_OOM！当工控机物理内存吃紧时，凝思系统不会单杀进程，而是会直接触发 Kernel Panic 导致整机突然重启！${NC}"
fi

if [ "$KERNEL_PANIC" != "0" ]; then
    echo -e "${YELLOW}[重要发现] kernel.panic 设置为 $KERNEL_PANIC (秒)！一旦发生任何轻微内核 Oops 或 Panic，主机将在 $KERNEL_PANIC 秒后强行自动重启！${NC}"
fi
echo ""

echo "=============================================================================="
echo " 6. SCADA 工业黑匣子与上次异常退出逆向诊断 (SCADA Blackbox)"
echo "=============================================================================="
LOGS_DIR="$WORK_DIR/logs"
if [ ! -d "$LOGS_DIR" ]; then
    LOGS_DIR="$SCRIPT_DIR/logs"
fi

if [ -d "$LOGS_DIR" ]; then
    echo -e "[*] 找到 SCADA 黑匣子日志目录: $LOGS_DIR"

    if [ -f "$LOGS_DIR/reboot_diagnosis_report.txt" ]; then
        echo -e "${CYAN}[上次重启智能诊断报告]:${NC}"
        cat "$LOGS_DIR/reboot_diagnosis_report.txt"
        echo ""
    fi

    if [ -f "$LOGS_DIR/heartbeat.json" ]; then
        echo -e "[*] 上次最后保存的系统快照 (heartbeat.json):"
        cat "$LOGS_DIR/heartbeat.json"
        echo ""
    fi

    if [ -f "$LOGS_DIR/fatal_crash.log" ]; then
        echo -e "${RED}[发现崩溃日志] $LOGS_DIR/fatal_crash.log 最后 15 行:${NC}"
        tail -n 15 "$LOGS_DIR/fatal_crash.log"
        echo ""
    fi
else
    echo -e "${YELLOW}[提示] 未在应用根目录找到 logs/ 目录，可能尚未以更新后的版本运行。${NC}"
fi

echo "=============================================================================="
echo " 7. 凝思工控机 综合处置建议与防突然重启一键加固配置"
echo "=============================================================================="
echo -e "${BOLD}根据诊断结果，推荐执行以下加固措施彻底防止突然重启：${NC}"
echo ""
echo -e "1. 【防止内存不足引发整机重启】执行以下命令，确保 OOM 时不重启主机，仅杀进程："
echo -e "   ${GREEN}sudo sysctl -w vm.panic_on_oom=0${NC}"
echo -e "   ${GREEN}sudo sysctl -w kernel.panic=0${NC}"
echo -e "   ${GREEN}sudo sysctl -w kernel.panic_on_oops=0${NC}"
echo ""
echo -e "2. 【永久固化到系统配置】将配置写入 /etc/sysctl.d/99-scada-industrial.conf："
echo -e "   ${CYAN}sudo bash -c 'cat <<EOF > /etc/sysctl.d/99-scada-industrial.conf"
echo -e "vm.panic_on_oom = 0"
echo -e "kernel.panic = 0"
echo -e "kernel.panic_on_oops = 0"
echo -e "kernel.hung_task_panic = 0"
echo -e "kernel.softlockup_panic = 0"
echo -e "fs.file-max = 2097152"
echo -e "EOF'${NC}"
echo -e "   ${CYAN}sudo sysctl -p /etc/sysctl.d/99-scada-industrial.conf${NC}"
echo ""
echo -e "3. 【排查硬件看门狗驱动超时】"
echo -e "   若系统装有研华/研祥看门狗，请检查 /etc/watchdog.conf 中的 timeout 参数，确保至少设定为 60 秒以上；或在工控机 BIOS 中关闭硬件 Watchdog Timer。"
echo ""
echo -e "4. 【本次 SCADA 程序已更新的内部防护】"
echo -e "   - 彻底解除 512MB V8 堆内存上限（现已上调至 2048MB），消除人工 OOM 崩溃；"
echo -e "   - 启用秒级心跳与黑匣子捕获，下一次若发生异常，重新打开 SCADA 即可在底栏直接查看确诊原因；"
echo -e "   - 消除 xset 子进程频繁派生泄露问题；"
echo -e "   - 完整报告已另存至: ${YELLOW}$REPORT_OUTPUT${NC}"
echo "=============================================================================="
