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
const score = defineModel<number>({
  default: 3,
  validator: (v: number) => v >= 1 && v <= 5
})

function setScore(value: number) {
  score.value = value
}

function isActive(value: number) {
  return value <= score.value
}
</script>
