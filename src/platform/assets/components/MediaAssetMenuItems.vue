<script setup lang="ts">
import type { MenuActionEntry, MenuEntry } from '@/types/menuTypes'

import Button from '@/components/ui/button/Button.vue'
import ContextMenuItem from '@/components/ui/context-menu/ContextMenuItem.vue'
import ContextMenuSeparator from '@/components/ui/context-menu/ContextMenuSeparator.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import { cn } from '@/utils/tailwindUtil'

const { entries, surface } = defineProps<{
  entries: MenuEntry[]
  surface: 'context' | 'dropdown'
}>()

const emit = defineEmits<{
  action: [entry: MenuActionEntry]
}>()

function isActionEntry(entry: MenuEntry): entry is MenuActionEntry {
  return entry.kind !== 'divider'
}
</script>

<template>
  <div
    class="media-asset-menu-panel flex min-w-56 flex-col rounded-lg border border-border-subtle bg-secondary-background p-2 text-base-foreground"
  >
    <template v-for="entry in entries" :key="entry.key">
      <ContextMenuSeparator
        v-if="surface === 'context' && entry.kind === 'divider'"
        class="m-1 h-px bg-border-subtle"
      />
      <DropdownMenuSeparator
        v-else-if="surface === 'dropdown' && entry.kind === 'divider'"
        class="m-1 h-px bg-border-subtle"
      />
      <ContextMenuItem
        v-else-if="surface === 'context' && isActionEntry(entry)"
        as-child
        :disabled="entry.disabled"
        :text-value="entry.label"
        @select="emit('action', entry)"
      >
        <Button variant="secondary" size="sm" class="w-full justify-start">
          <i v-if="entry.icon" :class="cn(entry.icon, 'size-4')" />
          <span>{{ entry.label }}</span>
        </Button>
      </ContextMenuItem>
      <DropdownMenuItem
        v-else-if="isActionEntry(entry)"
        as-child
        :disabled="entry.disabled"
        :text-value="entry.label"
        @select="emit('action', entry)"
      >
        <Button variant="secondary" size="sm" class="w-full justify-start">
          <i v-if="entry.icon" :class="cn(entry.icon, 'size-4')" />
          <span>{{ entry.label }}</span>
        </Button>
      </DropdownMenuItem>
    </template>
  </div>
</template>
