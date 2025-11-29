<script setup lang="ts">
import type { WidgetDefinition } from '@/types/node'
import WidgetSlider from './widgets/WidgetSlider.vue'
import WidgetNumber from './widgets/WidgetNumber.vue'
import WidgetText from './widgets/WidgetText.vue'
import WidgetSelect from './widgets/WidgetSelect.vue'
import WidgetToggle from './widgets/WidgetToggle.vue'
import WidgetColor from './widgets/WidgetColor.vue'

interface Props {
  widgets: WidgetDefinition[]
  values: Record<string, unknown>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:value': [name: string, value: unknown]
}>()

function handleUpdate(name: string, value: unknown): void {
  emit('update:value', name, value)
}

function getWidgetValue(widget: WidgetDefinition): unknown {
  return props.values[widget.name] ?? widget.value
}
</script>

<template>
  <div class="node-widgets px-2 flex flex-col gap-1">
    <div
      v-for="widget in widgets"
      :key="widget.name"
      class="widget-row flex items-center gap-3 min-h-[28px]"
    >
      <label class="widget-label text-[11px] text-zinc-400 shrink-0 min-w-[70px]">
        {{ widget.label || widget.name }}
      </label>

      <div class="flex-1 min-w-0">
        <WidgetSlider
          v-if="widget.type === 'slider'"
          :widget="widget as WidgetDefinition<number>"
          :model-value="getWidgetValue(widget) as number"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />

        <WidgetNumber
          v-else-if="widget.type === 'number'"
          :widget="widget as WidgetDefinition<number>"
          :model-value="getWidgetValue(widget) as number"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />

        <WidgetText
          v-else-if="widget.type === 'text'"
          :widget="widget as WidgetDefinition<string>"
          :model-value="getWidgetValue(widget) as string"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />

        <WidgetText
          v-else-if="widget.type === 'textarea'"
          :widget="widget as WidgetDefinition<string>"
          :model-value="getWidgetValue(widget) as string"
          :multiline="true"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />

        <WidgetSelect
          v-else-if="widget.type === 'select'"
          :widget="widget as WidgetDefinition<string | number>"
          :model-value="getWidgetValue(widget) as string | number"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />

        <WidgetToggle
          v-else-if="widget.type === 'toggle'"
          :widget="widget as WidgetDefinition<boolean>"
          :model-value="getWidgetValue(widget) as boolean"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />

        <WidgetColor
          v-else-if="widget.type === 'color'"
          :widget="widget as WidgetDefinition<string>"
          :model-value="getWidgetValue(widget) as string"
          @update:model-value="(v) => handleUpdate(widget.name, v)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-row {
  min-width: 0;
}

.widget-label {
  user-select: none;
}
</style>
