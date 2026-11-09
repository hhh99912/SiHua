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
  standalone?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  notice: '',
  standalone: false
});

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
      if (typeof window !== 'undefined' && (window as any).electronAPI?.userLoggedIn) {
        try {
          (window as any).electronAPI.userLoggedIn(currentUser.value);
        } catch {}
      }
      emit('success');
      emit('close');
    } else {
      errorMessage.value = res.message;
    }
  }, 180);
};

const handleLogoutToLoginScreen = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.sendUserAction) {
    try {
      (window as any).electronAPI.sendUserAction('logout');
    } catch {}
  }
  emit('logout');
  emit('close');
};

const handleCloseModal = () => {
  if (props.standalone && typeof window !== 'undefined' && (window as any).electronAPI?.closeLogin) {
    try {
      (window as any).electronAPI.closeLogin();
    } catch {}
  }
  emit('close');
};
</script>

<template>
  <div
    :class="standalone
      ? 'w-full h-full bg-[#f2eee3] flex flex-col justify-center overflow-y-auto font-sans p-2 select-none text-black'
      : 'fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-6 animate-in fade-in duration-150 text-black'"
  >
    <!-- 对标凝思米白色工业质感弹框 -->
    <div
      class="bg-[#ebe4d4] border-2 border-[#8c826d] flex flex-col overflow-hidden font-sans shadow-2xl"
      :class="standalone ? 'w-full shadow-none my-auto' : 'w-full max-w-lg'"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-[#cfc5b0] flex items-center justify-between bg-[#e5decb]">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-[#d4caaf] border border-[#b8ad96] text-sky-800">
            <ShieldCheck class="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 class="text-base font-bold text-black tracking-wide">SCADA 用户身份认证</h2>
            <p class="text-xs font-medium text-slate-700 mt-0.5">切换用户权限与操作身份</p>
          </div>
        </div>

        <button
          @click="handleCloseModal"
          class="p-1.5 hover:bg-[#ded5bf] border border-[#cfc5b0] text-slate-700 hover:text-black transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Notice Alert if triggered by permission failure -->
      <div v-if="notice" class="mx-5 mt-4 p-3 bg-[#fff8e6] border border-[#e6a23c] flex items-start gap-2 text-xs font-bold text-[#b87a14]">
        <ShieldAlert class="w-4 h-4 text-[#e6a23c] shrink-0 mt-0.5" />
        <div class="leading-relaxed">{{ notice }}</div>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleLogin" class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
            <span class="text-sm font-bold text-black">选择用户角色</span>
            <span class="text-xs font-mono font-medium text-slate-600 bg-[#dfd6bf] px-2 py-0.5 border border-[#cfc5b0]">
              共 {{ userList.length }} 个预设身份
            </span>
          </label>
          <div class="relative">
            <User class="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              v-model="selectedUsername"
              class="w-full appearance-none bg-white border border-[#b8ad96] hover:border-sky-600 pl-9 pr-9 py-2.5 text-sm font-medium text-black focus:border-sky-700 focus:outline-hidden transition-colors cursor-pointer"
            >
              <option
                v-for="u in userList"
                :key="u.username"
                :value="u.username"
                class="bg-white text-black py-1.5 font-medium"
              >
                {{ u.name }} —— 【{{ u.roleName }}】
              </option>
            </select>
            <ChevronDown class="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
            <span class="text-sm font-bold text-black">登录密码</span>
            <span class="text-xs font-medium text-slate-600 font-mono">初始密码: 123456</span>
          </label>
          <div class="relative">
            <Lock class="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码 (123456)"
              class="w-full bg-white border border-[#b8ad96] pl-9 pr-4 py-2 text-sm font-medium text-black placeholder-slate-400 focus:border-sky-700 focus:outline-hidden font-mono"
            />
          </div>
        </div>

        <div v-if="errorMessage" class="text-xs font-bold text-[#cc0000] bg-[#ffe5e5] border border-[#ff0000] p-2.5">
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full py-2.5 bg-sky-700 hover:bg-sky-800 border border-sky-950 text-white font-bold text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 tracking-wide"
        >
          <LogIn class="w-4 h-4" />
          <span>{{ isSubmitting ? '正在验证身份...' : '确认切换用户身份' }}</span>
        </button>

        <button
          type="button"
          @click="handleLogoutToLoginScreen"
          class="w-full py-2 bg-[#f2eee3] hover:bg-[#e4dcce] border border-[#b8ad96] text-black text-xs font-medium transition-all cursor-pointer tracking-wide"
        >
          注销当前账号 / 返回 SCADA 登录界面
        </button>
      </form>
    </div>
  </div>
</template>
