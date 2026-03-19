<template>
  <div
    class="job-menu-panel flex min-w-56 flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3 font-inter"
  >
    <template v-for="entry in entries" :key="entry.key">
      <div v-if="entry.kind === 'divider'" class="px-2 py-1">
        <div class="h-px bg-interface-stroke" />
      </div>
      <Button
        v-else
        class="w-full justify-start bg-transparent"
        variant="textonly"
        size="sm"
        :disabled="entry.disabled"
        @click="onEntry(entry)"
      >
        <i
          v-if="entry.icon"
          :class="[
            entry.icon,
            'block size-4 shrink-0 leading-none text-text-secondary'
          ]"
        />
        <span>{{ entry.label }}</span>
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  injectContextMenuRootContext,
  injectDropdownMenuRootContext
} from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

const { entries } = defineProps<{
  entries: MenuEntry[]
}>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()

const dropdownMenuRootContext = injectDropdownMenuRootContext(null)
const contextMenuRootContext = injectContextMenuRootContext(null)

function closeMenu() {
  dropdownMenuRootContext?.onOpenChange(false)
  contextMenuRootContext?.onOpenChange(false)
}

function onEntry(entry: MenuEntry) {
  if (entry.kind === 'divider' || entry.disabled) {
    return
  }

  closeMenu()
  emit('action', entry)
}
</script>
