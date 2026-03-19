<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        :collision-padding="8"
        class="z-50 bg-transparent p-0 font-inter shadow-lg"
      >
        <JobMenuPanel
          class="job-context-menu-content"
          :entries
          @action="emit('action', $event)"
        />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'

import type { MenuEntry } from '@/composables/queue/useJobMenu'

import JobMenuPanel from './JobMenuPanel.vue'

defineProps<{ entries: MenuEntry[] }>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()
</script>
