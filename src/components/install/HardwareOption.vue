<template>
  <div class="hardware-option-wrapper relative" :class="{ selected: selected }">
    <button
      class="hardware-option group relative flex flex-col items-center justify-center rounded-2xl border transition-all duration-200 border-neutral-700 bg-neutral-900/80 hover:border-neutral-600 hover:bg-neutral-800/80"
      @click="$emit('click')"
    >
      <div class="flex h-24 w-full items-center justify-center px-4">
        <img
          v-if="imagePath"
          :src="imagePath"
          :alt="title"
          class="max-h-20 max-w-full object-contain"
        />
      </div>
      <div class="mt-3 text-center">
        <div class="text-base font-normal text-neutral-100">{{ title }}</div>
        <div v-if="subtitle" class="mt-1 text-sm text-neutral-500">
          {{ subtitle }}
        </div>
      </div>
    </button>
  </div>
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
.hardware-option-wrapper {
  width: 176px;
  height: 176px;
  position: relative;
}

.hardware-option-wrapper.selected::before {
  content: '';
  position: absolute;
  inset: -10px;
  border: 3px solid rgb(250, 204, 21);
  border-radius: 32px;
  pointer-events: none;
}

.hardware-option {
  width: 100%;
  height: 100%;
  padding: 1.5rem;
}

.hardware-option:focus {
  outline: none;
}
</style>
