<template>
  <div
    class="flex items-center gap-2 px-4 py-2 text-xs rounded-md transition-colors cursor-pointer"
    :class="
      active
        ? 'bg-neutral-100 dark-theme:bg-zinc-700 text-neutral'
        : 'text-neutral hover:bg-zinc-100 hover:dark-theme:bg-zinc-700/50'
    "
    role="button"
    @click="onClick"
  >
    <i-lucide:folder v-if="hasFolderIcon" class="text-xs text-neutral" />
    <span class="flex items-center">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
const {
  hasFolderIcon = true,
  active,
  onClick
} = defineProps<{
  hasFolderIcon?: boolean
  active?: boolean
  onClick: () => void
}>()
</script>
