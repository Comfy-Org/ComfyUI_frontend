<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { WidgetDefinition } from '@/types/node'

interface Props {
  widget: WidgetDefinition<string>
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const disabled = computed(() => props.widget.options?.disabled ?? false)
const localValue = ref(props.modelValue)

watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = newVal
  }
)

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement
  localValue.value = target.value
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="widget-color" @pointerdown.stop @mousedown.stop>
    <div class="color-preview">
      <input
        type="color"
        :value="localValue"
        :disabled="disabled"
        class="color-input nodrag"
        @input="handleInput"
      />
    </div>
    <span class="color-value">{{ localValue.toUpperCase() }}</span>
  </div>
</template>

<style scoped>
.widget-color {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.color-preview {
  width: 32px;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #3f3f46;
}

.color-input {
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  cursor: pointer;
  background: transparent;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: none;
}

.color-input::-moz-color-swatch {
  border: none;
}

.color-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-value {
  font-size: 11px;
  font-family: monospace;
  color: #a1a1aa;
  min-width: 60px;
}
</style>
