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
    <i-lucide:folder class="text-xs text-neutral" />
    <span>
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
const { active, onClick } = defineProps<{
  active?: boolean
  onClick: () => void
}>()
</script>
