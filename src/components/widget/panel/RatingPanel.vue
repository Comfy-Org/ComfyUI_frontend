<template>
  <div
    class="flex min-h-0 scrollbar-hide w-full flex-auto flex-col items-center gap-1 overflow-y-auto bg-modal-panel-background px-3"
  >
    <div class="flex items-center gap-1 text-lg font-bold text-gray-800">
      <span class="min-w-[0.8em] text-xs text-yellow-600">{{ score }}</span>
      <span class="text-xs text-gray-400">/</span>
      <span class="text-xs text-gray-400">5</span>
    </div>
    <button
      v-for="value in [5, 4, 3, 2, 1]"
      :key="value"
      :aria-label="`Rate ${value} out of 5`"
      class="cursor-pointer rounded-full border-0 p-0 transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
      @click="setScore(value)"
    >
      <i
        :class="[
          'text-neutral',
          'icon-[lucide--star]',
          'shrink-0',
          'text-xs',
          isActive(value) ? 'text-yellow-500' : 'text-gray-500'
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Number,
    default: 3,
    validator: (v: number) => v >= 1 && v <= 5
  }
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const score = ref(props.modelValue)

watch(
  () => props.modelValue,
  (newVal) => {
    score.value = newVal
  }
)

function setScore(value: number) {
  score.value = value
  emit('update:modelValue', value)
}

function isActive(value: number) {
  return value <= score.value
}
</script>
