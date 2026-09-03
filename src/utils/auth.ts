import { ref } from 'vue';
import { UserProfile } from '../types';

export const PRESET_USERS: Array<UserProfile & { passwordHash: string }> = [
  {
    id: 'user-admin',
    username: 'admin',
    passwordHash: '123456',
    name: '系统管理员',
    role: 'system_admin',
    roleName: '系统管理员 (全权限)',
    description: '具备 SCADA 监控、画布编辑、图元工坊、测点管理等所有权限',
    permissions: ['view_preview', 'edit_canvas', 'custom_symbol', 'scada_control', 'batch_points', 'export_schema', 'history_curves']
  },
  {
    id: 'user-operator',
    username: 'operator',
    passwordHash: '123456',
    name: '普通用户',
    role: 'viewer',
    roleName: '普通用户 (仅监控)',
    description: '具备 SCADA 实时监视、遥控置数与历史曲线调阅权限',
    permissions: ['view_preview', 'scada_control', 'history_curves']
  },
  {
    id: 'user-engineer',
    username: 'engineer',
    passwordHash: '123456',
    name: '运维工程师',
    role: 'viewer',
    roleName: '运维工程师',
    description: '具备 SCADA 监控、告警巡检与历史曲线调阅权限',
    permissions: ['view_preview', 'scada_control', 'history_curves']
  },
  {
    id: 'user-dispatcher',
    username: 'dispatcher',
    passwordHash: '123456',
    name: '调度值班员',
    role: 'viewer',
    roleName: '调度值班员',
    description: '具备 SCADA 实时监视、遥测遥信监视与置数权限',
    permissions: ['view_preview', 'scada_control', 'history_curves']
  }
];

const AUTH_STORAGE_KEY = 'ge_scada_current_user_v1';

// Get initial user from local storage or default to system admin
const getInitialUser = (): UserProfile => {
  try {
    const cached = localStorage.getItem(AUTH_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const match = PRESET_USERS.find(u => u.username === parsed.username);
      if (match) {
        const { passwordHash, ...clean } = match;
        return clean;
      }
    }
  } catch (e) {
    console.error('Failed to parse cached user:', e);
  }
  // Default to system user so the app is immediately ready
  const { passwordHash, ...clean } = PRESET_USERS[0];
  return clean;
};

export const currentUser = ref<UserProfile>(getInitialUser());
export const isLoggedIn = ref<boolean>(false);

export const loginUser = (username: string, password: string): { success: boolean; message: string; user?: UserProfile } => {
  const match = PRESET_USERS.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!match) {
    return { success: false, message: '用户名不存在，请检查输入' };
  }

  if (match.passwordHash !== password.trim()) {
    return { success: false, message: '登录密码错误，请重新输入' };
  }

  const { passwordHash, ...cleanUser } = match;
  currentUser.value = cleanUser;
  isLoggedIn.value = true;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
  } catch (e) {}

  return { success: true, message: '登录成功', user: cleanUser };
};

export const switchQuickUser = (role: 'system_admin' | 'viewer'): UserProfile => {
  const target = PRESET_USERS.find(u => u.role === role) || PRESET_USERS[0];
  const { passwordHash, ...cleanUser } = target;
  currentUser.value = cleanUser;
  isLoggedIn.value = true;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
  } catch (e) {}
  return cleanUser;
};

export const logoutUser = () => {
  isLoggedIn.value = false;
  // Default to operator when logging out
  const target = PRESET_USERS.find(u => u.role === 'viewer') || PRESET_USERS[0];
  const { passwordHash, ...cleanUser } = target;
  currentUser.value = cleanUser;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cleanUser));
  } catch (e) {}
};

export const checkPermission = (perm: string): boolean => {
  return currentUser.value.permissions.includes(perm);
};

export const canEditCanvas = (): boolean => {
  return currentUser.value.role === 'system_admin';
};
