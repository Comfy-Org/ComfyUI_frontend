<template>
  <ul
    :aria-label="label"
    tabindex="0"
    class="m-0 max-h-112 list-none overflow-y-auto rounded-xl border border-border p-0 text-sm"
  >
    <li
      v-for="item in items"
      :key="item.key"
      class="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
    >
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="truncate font-medium" :title="item.name">
          {{ item.name }}
        </span>
        <span v-if="item.publisher" class="text-xs text-muted-foreground">
          {{ item.publisher }}
        </span>
      </span>
      <span class="flex shrink-0 items-center gap-2">
        <Badge v-if="item.pinned">{{ $t('buildCustomNodes.pinned') }}</Badge>
        <span class="font-mono text-xs text-muted-foreground">
          {{ item.version }}
        </span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import Badge from '@comfyorg/design-system/badge/Badge'

import type { NodePackListItem } from '@/platform/workspace/buildCustomNodes/useNodePackListItems'

const { label, items } = defineProps<{
  label: string
  items: readonly NodePackListItem[]
}>()
</script>
