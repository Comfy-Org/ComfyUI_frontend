<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
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
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {{ props.title }}
      </h1>
      <p v-if="props.subtitle" class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ props.subtitle }}
      </p>
    </div>
    <button
      v-if="props.actionLabel"
      class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      @click="emit('action')"
    >
      <i :class="[props.actionIcon, 'text-xs']" />
      {{ props.actionLabel }}
    </button>
  </div>
</template>
