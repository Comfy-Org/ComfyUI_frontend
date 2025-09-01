<template>
  <button
    class="hardware-option group relative flex flex-col items-center justify-center rounded-3xl border-2 transition-all duration-200"
    :class="{
      'border-yellow-500 bg-neutral-800/50': selected,
      'border-neutral-600 bg-neutral-900/50 hover:border-neutral-500 hover:bg-neutral-800/50':
        !selected
    }"
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
  width: 200px;
  height: 200px;
  padding: 1.5rem;
}

.hardware-option:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.4);
}
</style>
