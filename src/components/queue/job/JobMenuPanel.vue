<template>
  <div
    class="job-menu-panel flex min-w-56 flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3 font-inter"
  >
    <template v-for="entry in entries" :key="entry.key">
      <component
        :is="separatorComponent"
        v-if="entry.kind === 'divider'"
        class="px-2 py-1"
      >
        <div class="h-px bg-interface-stroke" />
      </component>
      <component
        :is="itemComponent"
        v-else
        as-child
        :disabled="entry.disabled"
        :text-value="entry.label"
        @select="onEntry(entry)"
      >
        <Button
          class="w-full justify-start bg-transparent data-highlighted:bg-secondary-background-hover"
          variant="textonly"
          size="sm"
          :aria-label="entry.label"
          :disabled="entry.disabled"
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
      </component>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
const itemComponent = dropdownMenuRootContext
  ? DropdownMenuItem
  : ContextMenuItem
const separatorComponent = dropdownMenuRootContext
  ? DropdownMenuSeparator
  : ContextMenuSeparator

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
