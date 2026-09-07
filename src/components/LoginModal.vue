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
    errorMessage.value = '请选择用户';
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div class="bg-[#050b18] border border-cyan-500/40 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(0,242,255,0.25)] flex flex-col overflow-hidden font-sans">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/70">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-400">
            <ShieldCheck class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white tracking-wide">SCADA 用户身份认证</h2>
            <p class="text-xs text-slate-400 mt-0.5">切换用户权限与操作身份</p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Notice Alert if triggered by permission failure -->
      <div v-if="notice" class="mx-6 mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2 text-xs text-amber-200">
        <ShieldAlert class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>{{ notice }}</div>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleLogin" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>选择用户角色</span>
            <span class="text-[10px] text-cyan-400 font-mono">共 {{ userList.length }} 个用户</span>
          </label>
          <div class="relative">
            <User class="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              v-model="selectedUsername"
              class="w-full appearance-none bg-slate-900 border border-slate-700 hover:border-cyan-500/60 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-hidden transition-colors cursor-pointer"
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

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>登录密码</span>
            <span class="text-[10px] text-slate-400 font-mono">统一初始密码: 123456</span>
          </label>
          <div class="relative">
            <Lock class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码 (123456)"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-hidden font-mono"
            />
          </div>
        </div>

        <div v-if="errorMessage" class="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl font-medium">
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <LogIn class="w-4 h-4" />
          <span>{{ isSubmitting ? '正在切换身份...' : '确认切换用户' }}</span>
        </button>

        <button
          type="button"
          @click="handleLogoutToLoginScreen"
          class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 hover:bg-amber-950/20 text-amber-300 text-xs font-mono transition-all cursor-pointer"
        >
          注销当前账号 / 返回 SCADA 登录界面
        </button>
      </form>
    </div>
  </div>
</template>
