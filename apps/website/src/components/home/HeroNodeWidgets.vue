<script setup lang="ts">
import { ChevronDown, Minus, Plus } from '@lucide/vue'

import type { NodeWidget } from './heroWorkflowGraph'

const { widgets } = defineProps<{ widgets: NodeWidget[] }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="widget in widgets"
      :key="widget.name"
      class="bg-hero-node-inset flex h-7 items-center justify-between gap-2 rounded-lg px-2.5 text-xs"
    >
      <template v-if="widget.kind === 'number'">
        <span class="flex min-w-0 items-center gap-2">
          <Minus class="size-3 shrink-0 text-white/30" />
          <span class="truncate text-white/40">{{ widget.name }}</span>
        </span>
        <span class="flex shrink-0 items-center gap-2 text-white/80">
          <span class="tabular-nums">{{ widget.value }}</span>
          <Plus class="size-3 text-white/30" />
        </span>
      </template>
      <template v-else>
        <span class="truncate text-white/40">{{ widget.name }}</span>
        <span class="flex min-w-0 items-center gap-1 text-white/80">
          <span class="truncate">{{ widget.value }}</span>
          <ChevronDown
            v-if="widget.kind === 'combo'"
            class="size-3 shrink-0 text-white/35"
          />
        </span>
      </template>
    </div>
  </div>
</template>
