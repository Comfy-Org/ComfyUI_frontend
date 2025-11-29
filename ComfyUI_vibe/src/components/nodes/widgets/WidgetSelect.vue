<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetDefinition } from '@/types/node'

interface Props {
  widget: WidgetDefinition<string | number>
  modelValue: string | number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const choices = computed(() => props.widget.options?.choices ?? [])
const disabled = computed(() => props.widget.options?.disabled ?? false)

function handleChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="widget-select" @pointerdown.stop @mousedown.stop>
    <select
      :value="modelValue"
      :disabled="disabled"
      class="custom-select nodrag"
      @change="handleChange"
    >
      <option
        v-for="choice in choices"
        :key="choice.value"
        :value="choice.value"
      >
        {{ choice.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.widget-select {
  width: 100%;
}

.custom-select {
  width: 100%;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #fafafa;
  padding: 6px 28px 6px 10px;
  font-size: 11px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.custom-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.custom-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-select option {
  background: #27272a;
  color: #fafafa;
}
</style>
