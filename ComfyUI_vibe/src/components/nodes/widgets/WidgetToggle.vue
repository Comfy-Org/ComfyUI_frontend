<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetDefinition } from '@/types/node'

interface Props {
  widget: WidgetDefinition<boolean>
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const disabled = computed(() => props.widget.options?.disabled ?? false)

function toggle(): void {
  if (!disabled.value) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <div class="widget-toggle" @pointerdown.stop @mousedown.stop>
    <button
      :class="[
        'toggle-button nodrag',
        modelValue && 'active',
      ]"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="toggle-track">
        <span class="toggle-thumb" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.widget-toggle {
  display: flex;
  align-items: center;
}

.toggle-button {
  position: relative;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-track {
  display: block;
  width: 36px;
  height: 20px;
  background: #3f3f46;
  border-radius: 10px;
  position: relative;
  transition: background-color 0.2s;
}

.toggle-button.active .toggle-track {
  background: #3b82f6;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fafafa;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-button.active .toggle-thumb {
  transform: translateX(16px);
}
</style>
