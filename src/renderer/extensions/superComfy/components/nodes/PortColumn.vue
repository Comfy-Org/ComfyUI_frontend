<script setup lang="ts">
import type { INodeSlot } from '@comfyorg/graph-model/interfaces'
import { cn } from '@comfyorg/tailwind-utils'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import { SuperCanvasKey } from '@/renderer/extensions/superComfy/canvas/canvasContext'
import {
  PORT_PITCH,
  PORT_TOP
} from '@/renderer/extensions/superComfy/canvas/canvasGeometry'
import type { PortSide } from '@/renderer/extensions/superComfy/canvas/canvasGeometry'
import type {
  NodeId,
  PortSpec
} from '@/renderer/extensions/superComfy/engine/documentSchema'

const { ports, side, missing, showLabels, nodeId } = defineProps<{
  ports: readonly PortSpec[]
  side: PortSide
  missing: readonly string[]
  showLabels: boolean
  nodeId: NodeId
}>()

const { t } = useI18n()
const canvas = inject(SuperCanvasKey, null)

const DOT_HALF = 12

function slotOf(port: PortSpec): INodeSlot {
  return { name: port.name, type: '*', boundingRect: [0, 0, 0, 0] }
}

function isMissing(port: PortSpec): boolean {
  return missing.includes(port.name)
}

function isDimmed(port: PortSpec): boolean {
  if (!canvas?.draftActive.value) return false
  return side === 'out' || !canvas.isCompatible(nodeId, port.name)
}

function rowStyle(index: number) {
  return { top: `${PORT_TOP + index * PORT_PITCH - DOT_HALF}px` }
}

function labelClass(port: PortSpec): string {
  const visible = showLabels || isMissing(port)
  return cn(
    'pointer-events-none absolute top-1/2 -translate-y-1/2 px-1 text-2xs whitespace-nowrap text-muted-foreground transition-opacity',
    side === 'in' ? 'right-full' : 'left-full',
    visible ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-100',
    isMissing(port) && 'text-destructive'
  )
}

function portName(port: PortSpec): string {
  return side === 'in'
    ? t('superComfy.port.input', { name: port.label })
    : t('superComfy.port.output', { name: port.label })
}

function onPointerDown(event: PointerEvent, port: PortSpec) {
  canvas?.onPortPointerDown(event, nodeId, side, port.name)
}
</script>

<template>
  <div
    v-for="(port, index) in ports"
    :key="port.name"
    :class="cn('absolute z-10', side === 'in' ? '-left-3' : '-right-3')"
    :style="rowStyle(index)"
  >
    <SlotConnectionDot
      :slot-data="slotOf(port)"
      :multi="port.multi"
      :has-error="isMissing(port)"
      :aria-label="portName(port)"
      :data-port-side="side"
      :data-port-name="port.name"
      :class="cn('transition-opacity', isDimmed(port) && 'opacity-30')"
      @pointerdown="onPointerDown($event, port)"
    />
    <span :class="labelClass(port)">{{ port.label }}</span>
  </div>
</template>
