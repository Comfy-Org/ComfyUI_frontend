<script setup lang="ts">
interface Props {
  icon: string
  title: string
  description: string
  actionLabel?: string
  actionIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  actionIcon: 'pi pi-plus'
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
      <i :class="[props.icon, 'text-xl text-zinc-400']" />
    </div>
    <h3 class="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ props.title }}</h3>
    <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{{ props.description }}</p>
    <button
      v-if="props.actionLabel"
      class="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      @click="emit('action')"
    >
      <i :class="[props.actionIcon, 'text-xs']" />
      {{ props.actionLabel }}
    </button>
  </div>
</template>
