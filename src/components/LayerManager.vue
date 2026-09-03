<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Edit2,
  Search
} from 'lucide-vue-next';
import { ScreenComponent } from '../types';

interface Props {
  components?: ScreenComponent[];
  selectedIds?: string[];
  selectedId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  components: () => [],
  selectedIds: () => [],
  selectedId: null
});

const emit = defineEmits<{
  (e: 'select', ids: string[]): void;
  (e: 'update:component', comp: ScreenComponent): void;
  (e: 'reorder', fromIndex: number, toIndex: number): void;
  (e: 'duplicate', comp: ScreenComponent): void;
  (e: 'delete', id: string): void;
  (e: 'bring:front', id: string): void;
  (e: 'send:back', id: string): void;
  (e: 'move:up', id: string): void;
  (e: 'move:down', id: string): void;
}>();

const editingId = ref<string | null>(null);
const editingName = ref('');
const filterKeyword = ref('');

const activeSelectedIds = computed(() => {
  if (props.selectedIds && props.selectedIds.length > 0) return props.selectedIds;
  if (props.selectedId) return [props.selectedId];
  return [];
});

// Display components in reverse order (top z-index on top)
const reversedComponents = computed(() => {
  const list = [...(props.components || [])].map((comp, originalIdx) => ({
    comp,
    originalIdx
  }));
  
  if (!filterKeyword.value) {
    return list.reverse();
  }
  const kw = filterKeyword.value.toLowerCase();
  return list.filter(item => 
    (item.comp?.name || '').toLowerCase().includes(kw) ||
    (item.comp?.type || '').toLowerCase().includes(kw)
  ).reverse();
});

const handleItemClick = (e: MouseEvent, compId: string) => {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (activeSelectedIds.value.includes(compId)) {
      emit('select', activeSelectedIds.value.filter(id => id !== compId));
    } else {
      emit('select', [...activeSelectedIds.value, compId]);
    }
  } else {
    emit('select', [compId]);
  }
};

const startRename = (comp: ScreenComponent) => {
  editingId.value = comp.id;
  editingName.value = comp.name;
};

const saveRename = (comp: ScreenComponent) => {
  if (editingName.value.trim()) {
    emit('update:component', {
      ...comp,
      name: editingName.value.trim()
    });
  }
  editingId.value = null;
};

const toggleVisibility = (comp: ScreenComponent, e: Event) => {
  e.stopPropagation();
  emit('update:component', {
    ...comp,
    visible: comp.visible === false ? true : false
  });
};

const toggleLock = (comp: ScreenComponent, e: Event) => {
  e.stopPropagation();
  emit('update:component', {
    ...comp,
    locked: !comp.locked
  });
};
</script>

<template>
  <aside class="w-60 shrink-0 h-full bg-[#060a15] border-r border-cyan-500/30 flex flex-col select-none z-30 shadow-2xl overflow-hidden font-sans">
    <!-- Header -->
    <div class="p-2.5 border-b border-cyan-500/20 bg-[#040812]">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5 font-mono font-bold text-xs text-cyan-200">
          <Layers class="w-3.5 h-3.5 text-cyan-400" />
          <span>图层与组件管理</span>
        </div>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold">
          {{ components.length }} 个元件
        </span>
      </div>

      <!-- Search Filter -->
      <div class="relative">
        <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="filterKeyword"
          type="text"
          placeholder="搜索图层名称/类型..."
          class="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-100 placeholder:text-slate-400 outline-hidden font-mono"
        />
      </div>
    </div>

    <!-- Layer List -->
    <div class="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
      <div
        v-if="reversedComponents.length === 0"
        class="text-center py-10 text-xs font-mono text-slate-400"
      >
        暂无图层或未匹配到元件
      </div>

      <div
        v-for="{ comp, originalIdx } in reversedComponents"
        :key="comp.id"
        @click="handleItemClick($event, comp.id)"
        class="group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border"
        :class="activeSelectedIds.includes(comp.id) 
          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100 shadow-xs' 
          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700'"
      >
        <!-- Left: Visibility, Lock & Name -->
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <!-- Visibility Toggle -->
          <button
            @click="toggleVisibility(comp, $event)"
            class="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            :title="comp.visible === false ? '显示图层' : '隐藏图层'"
          >
            <EyeOff v-if="comp.visible === false" class="w-3.5 h-3.5 text-slate-500" />
            <Eye v-else class="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <!-- Lock Toggle -->
          <button
            @click="toggleLock(comp, $event)"
            class="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
            :title="comp.locked ? '解锁图层' : '锁定图层'"
          >
            <Lock v-if="comp.locked" class="w-3.5 h-3.5 text-amber-400" />
            <Unlock v-else class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
          </button>

          <!-- Editable Name / Static Name -->
          <div class="flex-1 min-w-0 flex items-center gap-1">
            <span 
              v-if="activeSelectedIds.includes(comp.id) && activeSelectedIds.length > 1" 
              class="px-1 py-0.2 bg-cyan-400 text-slate-950 rounded-[2px] font-bold text-[9px] leading-tight shrink-0"
            >
              #{{ activeSelectedIds.indexOf(comp.id) + 1 }}
            </span>
            <input
              v-if="editingId === comp.id"
              v-model="editingName"
              @blur="saveRename(comp)"
              @keydown.enter="saveRename(comp)"
              @click.stop
              ref="nameInputRef"
              class="w-full bg-slate-900 border border-cyan-400 rounded px-1 py-0.5 text-xs text-white outline-hidden"
              autoFocus
            />
            <span 
              v-else
              @dblclick.stop="startRename(comp)"
              class="truncate text-xs font-semibold text-slate-200 group-hover:text-cyan-200"
              :class="{ 'line-through opacity-40': comp.visible === false }"
            >
              {{ comp.name }}
            </span>
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <!-- Bring to Front -->
          <button
            @click.stop="emit('bring:front', comp.id)"
            class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
            title="置于顶层"
          >
            <ArrowUpToLine class="w-3 h-3" />
          </button>

          <!-- Move Up (Z-index +1) -->
          <button
            @click.stop="emit('move:up', comp.id)"
            class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
            title="上移一层"
          >
            <ChevronUp class="w-3 h-3" />
          </button>

          <!-- Move Down (Z-index -1) -->
          <button
            @click.stop="emit('move:down', comp.id)"
            class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
            title="下移一层"
          >
            <ChevronDown class="w-3 h-3" />
          </button>

          <!-- Send to Back -->
          <button
            @click.stop="emit('send:back', comp.id)"
            class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
            title="置于底层"
          >
            <ArrowDownToLine class="w-3 h-3" />
          </button>

          <!-- Duplicate -->
          <button
            @click.stop="emit('duplicate', comp)"
            class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
            title="复制"
          >
            <Copy class="w-3 h-3" />
          </button>

          <!-- Delete -->
          <button
            @click.stop="emit('delete', comp.id)"
            class="p-1 rounded hover:bg-red-950 text-slate-400 hover:text-red-400"
            title="删除"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- Footer Quick Actions -->
    <div class="p-2 border-t border-slate-800 bg-[#040812] flex items-center justify-between text-[10px] font-mono text-slate-500">
      <span>双击名称可重命名</span>
      <span class="text-cyan-400">Shift可多选</span>
    </div>
  </aside>
</template>
