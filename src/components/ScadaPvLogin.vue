<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { 
  ShieldCheck, 
  LogIn, 
  Lock,
  User,
  AlertCircle,
  Activity,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  Server,
  Zap,
  Clock,
  Radio,
  Sparkles
} from 'lucide-vue-next';
import { currentUser, loginUser, PRESET_USERS } from '../utils/auth';

const emit = defineEmits<{
  (e: 'login:success'): void;
}>();

// User List from PRESET_USERS
const userList = computed(() => PRESET_USERS);

// Form state - Default to first user (系统管理员) and standard password (123456)
const selectedUsername = ref(PRESET_USERS[0]?.username || 'admin');
const password = ref('123456');
const showPassword = ref(false);
const errorMessage = ref('');
const isSubmitting = ref(false);

// Active selected user profile details
const currentSelectedUser = computed(() => {
  return PRESET_USERS.find(u => u.username === selectedUsername.value) || PRESET_USERS[0];
});

// Prominent Real-time SCADA Industrial Clock
const currentTime = ref('');
const currentDate = ref('');
const currentWeekDay = ref('');
let timerId: any = null;

const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const updateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  currentDate.value = `${year}-${month}-${day}`;
  currentTime.value = `${hours}:${minutes}:${seconds}`;
  currentWeekDay.value = weekDays[now.getDay()];
};

// Handle Login Form Submit
const handleLogin = () => {
  errorMessage.value = '';
  if (!selectedUsername.value) {
    errorMessage.value = '请选择登录用户';
    return;
  }
  if (!password.value.trim()) {
    errorMessage.value = '请输入登录密码';
    return;
  }

  isSubmitting.value = true;
  setTimeout(() => {
    const res = loginUser(selectedUsername.value, password.value);
    isSubmitting.value = false;
    if (res.success) {
      emit('login:success');
    } else {
      errorMessage.value = res.message;
    }
  }, 100);
};

onMounted(() => {
  updateTime();
  timerId = setInterval(updateTime, 1000);
});

onBeforeUnmount(() => {
  if (timerId) clearInterval(timerId);
});
</script>

<template>
  <div class="fixed inset-0 w-full h-full bg-[#030712] text-slate-100 font-sans select-none flex flex-col justify-between overflow-hidden z-50">
    <!-- Restrained Industrial Photovoltaic Background -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <!-- Soft Deep Ambient Glow -->
      <div class="absolute -top-[10%] -left-[5%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-cyan-900/15 blur-3xl pointer-events-none" />
      <div class="absolute -bottom-[15%] -right-[5%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-blue-900/15 blur-3xl pointer-events-none" />

      <!-- Photovoltaic Station Vector Graphics Layer (Subdued, elegant) -->
      <svg 
        class="absolute inset-0 w-full h-full opacity-25"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1920 1080"
      >
        <defs>
          <!-- PV Panel Pattern -->
          <pattern id="pv-cell-pattern-subdued" width="28" height="18" patternUnits="userSpaceOnUse">
            <rect width="27" height="17" fill="#061224" stroke="#00f2ff" stroke-width="0.8" stroke-opacity="0.3" rx="1" />
            <line x1="13.5" y1="0" x2="13.5" y2="17" stroke="#00f2ff" stroke-width="0.5" stroke-opacity="0.2" />
            <line x1="0" y1="8.5" x2="27" y2="8.5" stroke="#00f2ff" stroke-width="0.5" stroke-opacity="0.2" />
          </pattern>

          <!-- Sun Radiation Soft Gradient -->
          <radialGradient id="sun-glow-subdued" cx="80%" cy="15%" r="65%">
            <stop offset="0%" stop-color="#ffb703" stop-opacity="0.3" />
            <stop offset="30%" stop-color="#00f2ff" stop-opacity="0.1" />
            <stop offset="100%" stop-color="#030712" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- 1. Sun Solar Radiation Circles -->
        <circle cx="1600" cy="180" r="450" fill="url(#sun-glow-subdued)" />
        <circle cx="1600" cy="180" r="140" fill="none" stroke="#ffb703" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="6 4" />
        <circle cx="1600" cy="180" r="260" fill="none" stroke="#00f2ff" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="8 6" />
        <circle cx="1600" cy="180" r="390" fill="none" stroke="#00f2ff" stroke-width="0.8" stroke-opacity="0.2" stroke-dasharray="4 8" />

        <!-- Power Transmission Tower -->
        <g transform="translate(140, 360) scale(0.95)" stroke="#38bdf8" stroke-opacity="0.4" stroke-width="1.5" fill="none">
          <polygon points="120,40 100,340 140,340" stroke-opacity="0.5" stroke="#38bdf8" />
          <line x1="60" y1="100" x2="180" y2="100" stroke-width="1.8" />
          <line x1="40" y1="170" x2="200" y2="170" stroke-width="2" />
          <line x1="70" y1="240" x2="170" y2="240" stroke-width="1.5" />
          <line x1="100" y1="340" x2="140" y2="40" stroke-width="1" />
          <line x1="140" y1="340" x2="100" y2="40" stroke-width="1" />
          <line x1="60" y1="100" x2="120" y2="40" />
          <line x1="180" y1="100" x2="120" y2="40" />
          <line x1="40" y1="170" x2="120" y2="100" />
          <line x1="200" y1="170" x2="120" y2="100" />
          <line x1="70" y1="240" x2="100" y2="170" />
          <line x1="170" y1="240" x2="140" y2="170" />
        </g>

        <!-- Photovoltaic Panels Array -->
        <g fill="url(#pv-cell-pattern-subdued)">
          <polygon points="80,820 420,780 480,940 100,990" stroke="#00f2ff" stroke-width="1" stroke-opacity="0.4" />
          <polygon points="460,775 800,740 870,895 520,935" stroke="#00f2ff" stroke-width="1" stroke-opacity="0.4" />
          <polygon points="1380,740 1740,780 1800,945 1420,895" stroke="#00f2ff" stroke-width="1" stroke-opacity="0.4" />
          <polygon points="1060,775 1350,740 1390,895 1100,935" stroke="#00f2ff" stroke-width="1" stroke-opacity="0.4" />
        </g>
      </svg>
    </div>

    <!-- Top Industrial Navigation Header -->
    <header class="relative z-10 w-full px-4 sm:px-8 py-3 border-b border-slate-800 bg-[#070f1e]/80 backdrop-blur-md shrink-0 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-sm">
          <Zap class="w-4 h-4 text-cyan-400" />
        </div>
        <div class="flex items-center gap-2">
          <h1 class="text-sm sm:text-base font-bold text-slate-100 tracking-wider">
            GE-SCADA 工业监控平台
          </h1>
          <span class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
            v2.5.0
          </span>
        </div>
      </div>

      <!-- Real-time SCADA Clock (Prominent Single-Line Display) -->
      <div class="flex items-center gap-3 font-mono px-4 py-2 rounded-xl bg-[#041226]/90 border border-cyan-500/60 shadow-[0_0_25px_rgba(0,242,255,0.3)]">
        <div class="relative flex items-center justify-center">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute opacity-75"></span>
          <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2ff]"></span>
        </div>
        <Clock class="w-4 h-4 text-cyan-300" />
        <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold whitespace-nowrap">
          <span class="text-white font-mono tracking-wider">{{ currentDate }}</span>
          <span class="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs font-semibold">{{ currentWeekDay }}</span>
          <span class="text-cyan-300 font-black font-mono text-sm sm:text-base tracking-widest drop-shadow-[0_0_12px_rgba(0,242,255,0.8)]">{{ currentTime }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content Area: Centered Login Card -->
    <main class="relative z-10 flex-1 w-full flex items-center justify-center p-4">
      <div class="w-full max-w-sm sm:max-w-md bg-[#0a1224]/95 border border-cyan-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden backdrop-blur-xl">
        <!-- Top Accent Strip -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.5)]" />

        <!-- Form Title Header -->
        <div class="mb-5 text-center">
          <h2 class="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center justify-center gap-2">
            <span>系统身份登录</span>
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            请选择操作用户并输入密码
          </p>
        </div>

        <!-- Form with User Dropdown and Password -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- User Dropdown Menu -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">
              操作用户
            </label>
            <div class="relative">
              <User class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                v-model="selectedUsername"
                class="w-full appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden transition-colors cursor-pointer"
              >
                <option
                  v-for="u in userList"
                  :key="u.username"
                  :value="u.username"
                  class="bg-slate-900 text-white py-2"
                >
                  {{ u.name }} ({{ u.roleName }})
                </option>
              </select>
              <ChevronDown class="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">
              登录密码
            </label>
            <div class="relative">
              <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                class="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden transition-colors font-mono"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Error Alert -->
          <div 
            v-if="errorMessage"
            class="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2 font-medium"
          >
            <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full mt-2 py-2.5 sm:py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm tracking-wider shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <LogIn class="w-4 h-4" />
            <span>{{ isSubmitting ? '验证中...' : '登 录' }}</span>
          </button>
        </form>
      </div>
    </main>

    <!-- Bottom Industrial Footer -->
    <footer class="relative z-10 w-full px-4 sm:px-8 py-2.5 border-t border-slate-800 bg-[#070f1e]/80 backdrop-blur-md shrink-0 flex items-center justify-between text-xs text-slate-400 font-mono">
      <div class="flex items-center gap-2 text-slate-300 font-medium">
        <Server class="w-4 h-4 text-cyan-400" />
        <span>GE-SCADA 工业监控平台</span>
      </div>
      <div class="text-[11px] text-slate-400 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500" />
        <span>系统工况正常</span>
      </div>
    </footer>
  </div>
</template>
