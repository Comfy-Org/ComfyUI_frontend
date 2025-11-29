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
  height: 24px;
  background: #2a2a2e;
  border: none;
  border-radius: 4px;
  color: #e4e4e7;
  padding: 0 24px 0 10px;
  font-size: 11px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.custom-select:hover {
  background: #323238;
}

.custom-select:focus {
  background: #323238;
}

.custom-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.custom-select option {
  background: #2a2a2e;
  color: #e4e4e7;
}
</style>
