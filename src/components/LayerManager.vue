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
  Edit2
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

const activeSelectedIds = computed(() => {
  if (props.selectedIds && props.selectedIds.length > 0) return props.selectedIds;
  if (props.selectedId) return [props.selectedId];
  return [];
});

// Display components in reverse order (top z-index on top)
const reversedComponents = computed(() => {
  return [...(props.components || [])].map((comp, originalIdx) => ({
    comp,
    originalIdx
  })).reverse();
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
  editingName.value = '';
};

const toggleVisibility = (comp: ScreenComponent, e: MouseEvent) => {
  e.stopPropagation();
  emit('update:component', {
    ...comp,
    visible: comp.visible === false ? true : false
  });
};

const toggleLock = (comp: ScreenComponent, e: MouseEvent) => {
  e.stopPropagation();
  emit('update:component', {
    ...comp,
    locked: !comp.locked
  });
};
</script>

<template>
  <aside class="w-80 shrink-0 h-full bg-white border-r border-slate-200 flex flex-col select-none z-30 shadow-xs overflow-hidden font-sans text-slate-800 tracking-wide">
    <!-- Header: Title & Total Count -->
    <div class="px-3.5 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center font-bold text-xs shadow-2xs">
          <Layers class="w-4 h-4" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 tracking-wide leading-none">
            图层管理
          </h3>
          <span class="text-[10px] text-slate-400 font-mono leading-none tracking-normal">
            Layer Hierarchy
          </span>
        </div>
      </div>

      <span class="text-[12px] font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded">
        共 {{ components?.length || 0 }} 个元件
      </span>
    </div>

    <!-- Components List in Reverse Z-Index Order -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50">
      <div
        v-if="reversedComponents.length === 0"
        class="text-center py-12 text-sm text-slate-400 font-medium"
      >
        暂无图层元件
      </div>

      <div
        v-for="{ comp } in reversedComponents"
        :key="comp.id"
        @click="handleItemClick($event, comp.id)"
        class="group flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition-colors cursor-pointer border shadow-2xs"
        :class="activeSelectedIds.includes(comp.id) 
          ? 'bg-sky-50 border-sky-300 text-sky-950 font-bold ring-1 ring-sky-200' 
          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300'"
      >
        <!-- Left: Visibility, Lock & Name -->
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <!-- Visibility Toggle -->
          <button
            @click="toggleVisibility(comp, $event)"
            class="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
            :title="comp.visible === false ? '显示图层' : '隐藏图层'"
          >
            <EyeOff v-if="comp.visible === false" class="w-4 h-4 text-slate-300" />
            <Eye v-else class="w-4 h-4 text-slate-600 stroke-[2]" />
          </button>

          <!-- Lock Toggle -->
          <button
            @click="toggleLock(comp, $event)"
            class="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
            :title="comp.locked ? '解锁图层' : '锁定图层'"
          >
            <Lock v-if="comp.locked" class="w-4 h-4 text-amber-600 stroke-[2]" />
            <Unlock v-else class="w-4 h-4 text-slate-400 group-hover:text-slate-600 stroke-[2]" />
          </button>

          <!-- Editable Name / Static Name -->
          <div class="flex-1 min-w-0 flex items-center gap-1.5">
            <span 
              v-if="activeSelectedIds.includes(comp.id) && activeSelectedIds.length > 1" 
              class="px-1.5 py-0.2 bg-sky-600 text-white rounded text-[10px] font-bold font-mono leading-tight shrink-0"
            >
              #{{ activeSelectedIds.indexOf(comp.id) + 1 }}
            </span>
            <input
              v-if="editingId === comp.id"
              v-model="editingName"
              @blur="saveRename(comp)"
              @keydown.enter="saveRename(comp)"
              @click.stop
              class="w-full bg-white border border-sky-400 rounded px-1.5 py-0.5 text-[13px] text-slate-900 outline-hidden font-bold"
              autoFocus
            />
            <span 
              v-else
              @dblclick.stop="startRename(comp)"
              class="truncate text-[13px] text-slate-800 font-medium tracking-wide"
              :class="{ 'line-through text-slate-400': comp.visible === false }"
            >
              {{ comp.name }}
            </span>
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
          <!-- Bring to Front -->
          <button
            @click.stop="emit('bring:front', comp.id)"
            class="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="置于顶层"
          >
            <ArrowUpToLine class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <!-- Move Up (Z-index +1) -->
          <button
            @click.stop="emit('move:up', comp.id)"
            class="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="上移一层"
          >
            <ChevronUp class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <!-- Move Down (Z-index -1) -->
          <button
            @click.stop="emit('move:down', comp.id)"
            class="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="下移一层"
          >
            <ChevronDown class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <!-- Send to Back -->
          <button
            @click.stop="emit('send:back', comp.id)"
            class="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="置于底层"
          >
            <ArrowDownToLine class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <!-- Duplicate -->
          <button
            @click.stop="emit('duplicate', comp)"
            class="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="复制"
          >
            <Copy class="w-3.5 h-3.5 stroke-[2]" />
          </button>

          <!-- Delete -->
          <button
            @click.stop="emit('delete', comp.id)"
            class="p-1 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
            title="删除"
          >
            <Trash2 class="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
