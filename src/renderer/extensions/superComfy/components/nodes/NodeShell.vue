<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import {
  HEADER_GAP,
  HEADER_H,
  cardMinHeight
} from '@/renderer/extensions/superComfy/canvas/canvasGeometry'
import type {
  NodeId,
  PortSpec
} from '@/renderer/extensions/superComfy/engine/documentSchema'

import PortColumn from './PortColumn.vue'

const {
  nodeId,
  inputs,
  outputs,
  selected,
  running,
  missing,
  showLabels,
  progress = null
} = defineProps<{
  nodeId: NodeId
  inputs: readonly PortSpec[]
  outputs: readonly PortSpec[]
  selected: boolean
  running: boolean
  missing: readonly string[]
  showLabels: boolean
  progress?: number | null
}>()

const headerStyle = {
  top: `-${HEADER_H + HEADER_GAP}px`,
  height: `${HEADER_H}px`
}

const cardStyle = computed(() => ({
  minHeight: `${cardMinHeight(Math.max(inputs.length, outputs.length))}px`
}))

const progressStyle = computed(() => ({
  width: `${Math.round((progress ?? 0) * 100)}%`
}))
</script>

<template>
  <div class="group/node relative flex flex-col text-xs text-node-foreground">
    <div
      class="absolute inset-x-0 flex items-center gap-2"
      :style="headerStyle"
    >
      <slot name="header" />
    </div>
    <div
      :class="
        cn(
          'relative flex flex-col overflow-hidden rounded-2xl border border-node-border bg-node shadow-sm',
          selected && 'ring-1 ring-foreground/40',
          running && 'ring-1 ring-primary'
        )
      "
      :style="cardStyle"
    >
      <slot name="preview" />
      <div
        v-if="running && progress !== null"
        class="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
        :style="progressStyle"
      />
    </div>
    <PortColumn :ports="inputs" side="in" :missing :show-labels :node-id />
    <PortColumn :ports="outputs" side="out" :missing :show-labels :node-id />
    <div class="flex min-h-2 items-center justify-between gap-2 px-1">
      <slot name="gap" />
    </div>
    <slot name="settings" />
  </div>
</template>
