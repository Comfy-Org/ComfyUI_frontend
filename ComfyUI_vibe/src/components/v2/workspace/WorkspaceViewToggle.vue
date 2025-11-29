<script setup lang="ts">
type ViewMode = 'grid' | 'list'

defineProps<{
  modelValue: ViewMode
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ViewMode]
}>()
</script>

<template>
  <div class="flex rounded-md border border-zinc-200 dark:border-zinc-700">
    <button
      :class="[
        'px-3 py-2 text-sm transition-colors',
        modelValue === 'grid'
          ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      ]"
      @click="emit('update:modelValue', 'grid')"
    >
      <i class="pi pi-th-large" />
    </button>
    <button
      :class="[
        'px-3 py-2 text-sm transition-colors',
        modelValue === 'list'
          ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      ]"
      @click="emit('update:modelValue', 'list')"
    >
      <i class="pi pi-list" />
    </button>
  </div>
</template>
