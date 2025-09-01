<template>
  <button
    class="hardware-option group relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-200"
    :class="{
      'border-yellow-500 bg-neutral-800': selected,
      'border-neutral-700 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800':
        !selected
    }"
    @click="$emit('click')"
  >
    <div class="flex h-32 w-32 items-center justify-center">
      <img
        v-if="imagePath"
        :src="imagePath"
        :alt="title"
        class="max-h-full max-w-full object-contain"
      />
    </div>
    <div class="mt-2 text-center">
      <div class="text-sm font-medium text-neutral-100">{{ title }}</div>
      <div v-if="subtitle" class="text-xs text-neutral-400">{{ subtitle }}</div>
    </div>
  </button>
</template>

<script setup lang="ts">
interface Props {
  imagePath?: string
  title: string
  subtitle?: string
  value: string
  selected?: boolean
}

defineProps<Props>()

defineEmits<{
  click: []
}>()
</script>

<style scoped>
.hardware-option {
  width: 160px;
  height: 160px;
  padding: 1rem;
}

.hardware-option:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.4);
}
</style>
</template>