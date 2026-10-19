<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  X, 
  User, 
  Lock, 
  ShieldCheck, 
  ShieldAlert, 
  ChevronDown,
  LogIn
} from 'lucide-vue-next';
import { currentUser, loginUser, PRESET_USERS } from '../utils/auth';

interface Props {
  notice?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
  (e: 'logout'): void;
}>();

const userList = computed(() => PRESET_USERS);
const selectedUsername = ref(currentUser.value.username || PRESET_USERS[0].username);
const password = ref('123456');
const errorMessage = ref('');
const isSubmitting = ref(false);

const handleLogin = () => {
  errorMessage.value = '';
  if (!selectedUsername.value) {
    errorMessage.value = '请选择用户角色';
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
      emit('success');
      emit('close');
    } else {
      errorMessage.value = res.message;
    }
  }, 180);
};

const handleLogoutToLoginScreen = () => {
  emit('logout');
  emit('close');
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6 animate-in fade-in duration-200">
    <!-- 放大且加粗的登录切换弹框 -->
    <div class="bg-[#050b18] border-2 border-cyan-500/50 rounded-2xl w-full max-w-xl shadow-[0_0_80px_rgba(0,242,255,0.3)] flex flex-col overflow-hidden font-sans">
      <!-- Header -->
      <div class="px-8 py-5 border-b border-cyan-500/25 flex items-center justify-between bg-slate-950/80">
        <div class="flex items-center gap-3.5">
          <div class="p-3 rounded-xl bg-cyan-950 border border-cyan-500/60 text-cyan-400 shadow-md">
            <ShieldCheck class="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2 class="text-xl font-extrabold text-white tracking-wide">SCADA 用户身份认证</h2>
            <p class="text-sm font-semibold text-slate-300 mt-0.5">切换用户权限与操作身份</p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
        >
          <X class="w-6 h-6 stroke-[2]" />
        </button>
      </div>

      <!-- Notice Alert if triggered by permission failure -->
      <div v-if="notice" class="mx-8 mt-5 p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/50 flex items-start gap-2.5 text-sm font-bold text-amber-200">
        <ShieldAlert class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div class="leading-relaxed">{{ notice }}</div>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleLogin" class="p-8 space-y-6">
        <div>
          <label class="block text-sm font-bold text-slate-200 mb-2 flex items-center justify-between">
            <span class="text-base font-extrabold text-white">选择用户角色</span>
            <span class="text-xs font-bold text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              共 {{ userList.length }} 个预设身份
            </span>
          </label>
          <div class="relative">
            <User class="w-5 h-5 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              v-model="selectedUsername"
              class="w-full appearance-none bg-slate-900 border-2 border-slate-700 hover:border-cyan-500/70 rounded-xl pl-11 pr-10 py-3.5 text-base font-bold text-white focus:border-cyan-400 focus:outline-hidden transition-colors cursor-pointer"
            >
              <option
                v-for="u in userList"
                :key="u.username"
                :value="u.username"
                class="bg-slate-900 text-white py-2 font-bold"
              >
                {{ u.name }} —— 【{{ u.roleName }}】
              </option>
            </select>
            <ChevronDown class="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-bold text-slate-200 mb-2 flex items-center justify-between">
            <span class="text-base font-extrabold text-white">登录密码</span>
            <span class="text-xs font-bold text-slate-400 font-mono">初始密码: 123456</span>
          </label>
          <div class="relative">
            <Lock class="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码 (123456)"
              class="w-full bg-slate-900 border-2 border-slate-700 rounded-xl pl-11 pr-4 py-3 text-base font-bold text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-hidden font-mono tracking-widest"
            />
          </div>
        </div>

        <div v-if="errorMessage" class="text-sm font-bold text-rose-300 bg-rose-950/60 border border-rose-500/40 p-3.5 rounded-xl">
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-base shadow-[0_0_25px_rgba(0,242,255,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 tracking-wide"
        >
          <LogIn class="w-5 h-5 stroke-[2.5]" />
          <span>{{ isSubmitting ? '正在验证身份...' : '确认切换用户身份' }}</span>
        </button>

        <button
          type="button"
          @click="handleLogoutToLoginScreen"
          class="w-full py-3 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-amber-500/60 hover:bg-amber-950/30 text-amber-300 hover:text-amber-200 text-sm font-bold transition-all cursor-pointer tracking-wide"
        >
          注销当前账号 / 返回 SCADA 登录界面
        </button>
      </form>
    </div>
  </div>
</template>
