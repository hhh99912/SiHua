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
  <aside class="w-80 shrink-0 h-full bg-[#ebe4d4] border-r border-[#cfc5b0] flex flex-col select-none z-30 overflow-hidden font-sans text-slate-800 tracking-wide">
    <!-- Header: Title & Total Count -->
    <div class="px-3.5 py-2.5 border-b border-[#cfc5b0] bg-[#ebe4d4] flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded bg-[#e4dcce] text-sky-700 border border-[#cfc5b0] flex items-center justify-center font-medium text-xs shadow-2xs">
          <Layers class="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 class="text-[14px] font-medium text-slate-800 tracking-wide leading-none">
            图层管理
          </h3>
        </div>
      </div>

      <span class="text-xs font-mono font-normal text-slate-600 bg-[#e4dcce] border border-[#cfc5b0] px-2 py-0.5 rounded">
        共 {{ components?.length || 0 }} 个元件
      </span>
    </div>

    <!-- Components List in Reverse Z-Index Order (极简扁平单行，无卡片，大小一致) -->
    <div class="flex-1 overflow-y-auto bg-[#ebe4d4] divide-y divide-[#ded5bf]">
      <div
        v-if="reversedComponents.length === 0"
        class="text-center py-12 text-[13px] text-slate-400 font-normal"
      >
        暂无图层元件
      </div>

      <div
        v-for="{ comp } in reversedComponents"
        :key="comp.id"
        @click="handleItemClick($event, comp.id)"
        class="group flex items-center justify-between px-3.5 py-2 text-[14px] transition-colors cursor-pointer"
        :class="activeSelectedIds.includes(comp.id) 
          ? 'bg-[#e4dcce] text-sky-900 font-medium border-l-3 border-sky-600' 
          : 'text-slate-800 hover:bg-[#e4dcce] font-normal border-l-3 border-transparent'"
      >
        <!-- Left: Visibility, Lock & Name -->
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <!-- Visibility Toggle -->
          <button
            @click="toggleVisibility(comp, $event)"
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <EyeOff v-if="comp.visible === false" class="w-4 h-4 text-slate-300" />
            <Eye v-else class="w-4 h-4 text-slate-600 stroke-[2]" />
          </button>

          <!-- Lock Toggle -->
          <button
            @click="toggleLock(comp, $event)"
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-500 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
          >
            <Lock v-if="comp.locked" class="w-4 h-4 text-amber-600 stroke-[2]" />
            <Unlock v-else class="w-4 h-4 text-slate-400 group-hover:text-slate-600 stroke-[2]" />
          </button>

          <!-- Editable Name / Static Name -->
          <div class="flex-1 min-w-0 flex items-center gap-1.5">
            <span 
              v-if="activeSelectedIds.includes(comp.id) && activeSelectedIds.length > 1" 
              class="px-1.5 py-0.2 bg-sky-600 text-white rounded text-[10px] font-medium font-mono leading-tight shrink-0"
            >
              #{{ activeSelectedIds.indexOf(comp.id) + 1 }}
            </span>
            <input
              v-if="editingId === comp.id"
              v-model="editingName"
              @blur="saveRename(comp)"
              @keydown.enter="saveRename(comp)"
              @click.stop
              class="w-full bg-[#f2eee3] border border-sky-400 rounded px-1.5 py-0.5 text-[14px] text-slate-900 outline-hidden font-medium"
              autoFocus
            />
            <span 
              v-else
              @dblclick.stop="startRename(comp)"
              class="truncate text-[14px] text-slate-800 font-medium tracking-wide"
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
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowUpToLine class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- Move Up (Z-index +1) -->
          <button
            @click.stop="emit('move:up', comp.id)"
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ChevronUp class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- Move Down (Z-index -1) -->
          <button
            @click.stop="emit('move:down', comp.id)"
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ChevronDown class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- Send to Back -->
          <button
            @click.stop="emit('send:back', comp.id)"
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowDownToLine class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- Duplicate -->
          <button
            @click.stop="emit('duplicate', comp)"
            class="p-1 rounded hover:bg-[#e4ded2] text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <Copy class="w-4 h-4 stroke-[2]" />
          </button>

          <!-- Delete -->
          <button
            @click.stop="emit('delete', comp.id)"
            class="p-1 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
          >
            <Trash2 class="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
