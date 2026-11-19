<script setup lang="ts">
import { useElementBounding } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAskAgentAboutNodes } from '@/workbench/extensions/agent/composables/agent/useAskAgentAboutNodes'
import type {
  AgentCanvasPin as Pin,
  AgentCanvasPinStatus
} from '@/workbench/extensions/agent/stores/agent/agentCanvasPinStore'
import {
  pinShowsWhenHidden,
  useAgentCanvasPinStore
} from '@/workbench/extensions/agent/stores/agent/agentCanvasPinStore'

import AgentCanvasPin from './AgentCanvasPin.vue'
import type { PinBox, ScreenPoint } from './agentPinPlacement'
import { clearOfSockets, pinBoxAt } from './agentPinPlacement'

const SIZE = 28
const STATUS_LABEL: Record<AgentCanvasPinStatus, string> = {
  working: 'agent.nodeAsk.status.working',
  waiting: 'agent.nodeAsk.status.waiting',
  done: 'agent.nodeAsk.status.done',
  failed: 'agent.nodeAsk.status.failed',
  seen: 'agent.nodeAsk.status.seen'
}

const { t } = useI18n()
const lg = useCanvasStore().getCanvas()
const workflowStore = useWorkflowStore()
const settingStore = useSettingStore()
const pinStore = useAgentCanvasPinStore()
const { openAgentChat } = useAskAgentAboutNodes()
const { left: canvasLeft, top: canvasTop } = useElementBounding(lg.canvas)

const tick = ref(0)
onUnmounted(onCanvasFrame(lg, 'present', () => tick.value++))

function toScreen([x, y]: readonly [number, number]): ScreenPoint {
  const { scale, offset } = lg.ds
  return {
    x: (x + offset[0]) * scale + canvasLeft.value,
    y: (y + offset[1]) * scale + canvasTop.value
  }
}

function placeFor(pin: Pin): PinBox | undefined {
  const graphNodes = lg.graph?.nodes ?? []
  const node = pin.nodeIds
    .map((id) => graphNodes.find((candidate) => String(candidate.id) === id))
    .find((found): found is LGraphNode => found !== undefined)
  if (!node) return undefined
  const [x, y, width] = node.boundingRect
  const box = pinBoxAt(toScreen([x + width, y]), SIZE)
  if (lg.low_quality) return box
  const sockets = [
    ...(node.inputs ?? []).map((_, i) => node.getInputPos(i)),
    ...(node.outputs ?? []).map((_, i) => node.getOutputPos(i))
  ].map(([sx, sy]) => toScreen([sx, sy]))
  return clearOfSockets(box, sockets)
}

const placed = computed(() => {
  void tick.value
  const path = workflowStore.activeWorkflow?.path
  const hidden = settingStore.get('Comfy.Agent.CanvasPinsHidden')
  return pinStore.pins.flatMap((pin) => {
    if (pin.workflowPath !== path) return []
    const status = pinStore.statusOf(pin)
    if (hidden && !pinShowsWhenHidden(status)) return []
    const box = placeFor(pin)
    return box ? [{ pin, status, box }] : []
  })
})

function open(pin: Pin): void {
  pinStore.markSeen(pin.id)
  void openAgentChat(pin.threadId)
}
</script>

<template>
  <div
    data-testid="agent-canvas-pins"
    class="pointer-events-none fixed inset-0 z-30 overflow-hidden"
  >
    <AgentCanvasPin
      v-for="{ pin, status, box } in placed"
      :key="pin.id"
      :status
      :left="box.left"
      :top="box.top"
      :label="t('agent.nodeAsk.pin', { status: t(STATUS_LABEL[status]) })"
      @open="open(pin)"
    />
  </div>
</template>
