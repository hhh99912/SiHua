<script setup lang="ts">
import { computed } from 'vue';
import { ScreenComponent, DatasetItem } from '../../types';

interface Props {
  component: ScreenComponent;
  datasets?: DatasetItem[];
}

const props = defineProps<Props>();

const compiledHtml = computed(() => {
  const { style, data, customProps } = props.component;
  const boundDs = props.datasets?.find(d => d.id === data?.datasetId);

  let template = style.customHtmlCode || customProps?.htmlCode || `
<div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(8, 16, 32, 0.85); border: 1px solid rgba(0, 242, 255, 0.4); border-radius: 8px; padding: 12px; color: #fff; font-family: monospace;">
  <div style="font-size: 11px; color: #00f2ff; letter-spacing: 1px;">CUSTOM HTML ELEMENT</div>
  <div style="font-size: 24px; font-weight: bold; color: #e2f1ff; margin-top: 4px;">{{ value }}</div>
  <div style="font-size: 10px; color: #64748b; margin-top: 2px;">DataV Custom Primitive</div>
</div>
  `.trim();

  // If bound dataset exists, replace {{ fieldName }} or {{ value }}
  if (boundDs && boundDs.data) {
    const valKey = data?.mapping?.valueKey;
    const currentVal = valKey ? boundDs.data[valKey] : (boundDs.data.value ?? '128.4');

    template = template.replace(/\{\{\s*value\s*\}\}/g, String(currentVal ?? ''));
    template = template.replace(/\{\{\s*title\s*\}\}/g, String(data?.mapping?.titleKey || props.component.name));
    template = template.replace(/\{\{\s*unit\s*\}\}/g, String(data?.mapping?.unitKey || ''));

    // Replace other fields
    for (const [k, v] of Object.entries(boundDs.data)) {
      const reg = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      template = template.replace(reg, String(v));
    }
  } else {
    template = template.replace(/\{\{\s*value\s*\}\}/g, '0.00');
    template = template.replace(/\{\{\s*title\s*\}\}/g, props.component.name);
    template = template.replace(/\{\{\s*unit\s*\}\}/g, '');
  }

  return template;
});
</script>

<template>
  <div 
    class="w-full h-full relative overflow-hidden select-none"
    :style="{ opacity: component.style.opacity ?? 1 }"
    v-html="compiledHtml"
  />
</template>
