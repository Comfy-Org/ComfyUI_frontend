<template>
  <div
    class="flex items-center gap-2 px-4 py-2 text-xs rounded-md transition-colors cursor-pointer"
    :class="
      active
        ? 'bg-neutral-100 dark-theme:bg-zinc-700 text-neutral'
        : 'text-neutral hover:bg-zinc-100 dark-theme:hover:bg-zinc-700/50'
    "
    role="button"
    @click="onClick"
  >
    <NavIcon v-if="icon" :icon="icon" />
    <i-lucide:folder v-else class="text-xs text-neutral" />
    <span class="flex items-center">
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { DefineComponent } from 'vue'

import NavIcon from './NavIcon.vue'

const { icon, active, onClick } = defineProps<{
  icon: DefineComponent
  active?: boolean
  onClick: () => void
}>()
</script>
