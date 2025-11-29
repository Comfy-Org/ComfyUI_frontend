<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetDefinition } from '@/types/node'

interface Props {
  widget: WidgetDefinition<string>
  modelValue: string
  multiline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  multiline: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const placeholder = computed(() => props.widget.options?.placeholder ?? '')
const disabled = computed(() => props.widget.options?.disabled ?? false)

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="widget-text" @pointerdown.stop @mousedown.stop>
    <textarea
      v-if="multiline"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="custom-textarea nodrag"
      rows="3"
      @input="handleInput"
    />
    <input
      v-else
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="custom-input nodrag"
      @input="handleInput"
    />
  </div>
</template>

<style scoped>
.widget-text {
  width: 100%;
}

.custom-input,
.custom-textarea {
  width: 100%;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #fafafa;
  padding: 6px 10px;
  font-size: 11px;
  outline: none;
  resize: none;
}

.custom-input:focus,
.custom-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.custom-input:disabled,
.custom-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-input::placeholder,
.custom-textarea::placeholder {
  color: #71717a;
}
</style>
