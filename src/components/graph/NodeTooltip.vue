<template>
  <div
    v-show="tooltipText"
    ref="tooltipRef"
    class="node-tooltip z-overlay"
    :style="{ left, top }"
  >
    {{ tooltipText }}
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { nextTick, ref } from 'vue'

import { appTooltipProviderDefaults } from '@comfyorg/design-system/lib/tooltip/tooltipConfig'
import { resolveNodeDefSlotText, resolveNodeDefText } from '@/i18n'
import {
  LiteGraph,
  isOverNodeInput,
  isOverNodeOutput
} from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useApp } from '@/scripts/appInstance'
import { isDOMWidget } from '@/scripts/domWidget'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const nodeDefStore = useNodeDefStore()
const settingStore = useSettingStore()
const tooltipRef = ref<HTMLDivElement | undefined>()
const tooltipText = ref('')
const left = ref<string>()
const top = ref<string>()
let touchOrigin: { x: number; y: number } | undefined
const { start: startIdle, stop: stopIdle } = useTimeoutFn(
  onIdle,
  () =>
    touchOrigin
      ? appTooltipProviderDefaults.delayDuration
      : settingStore.get('LiteGraph.Node.TooltipDelay'),
  { immediate: false }
)

function hideTooltip() {
  stopIdle()
  touchOrigin = undefined
  if (!tooltipText.value) return
  tooltipText.value = ''
}

async function showTooltip(tooltip: string | null | undefined) {
  if (!tooltip) return

  left.value = useApp().canvas.mouse[0] + 'px'
  top.value = useApp().canvas.mouse[1] + 'px'
  tooltipText.value = tooltip

  await nextTick()

  const rect = tooltipRef.value?.getBoundingClientRect()
  if (!rect) return

  if (rect.right > window.innerWidth) {
    left.value = useApp().canvas.mouse[0] - rect.width + 'px'
  }

  if (rect.top < 0) {
    top.value = useApp().canvas.mouse[1] + rect.height + 'px'
  }
}

function onIdle() {
  const { canvas } = useApp()
  if (canvas?.linkConnector.isConnecting) return
  const node = touchOrigin
    ? canvas?.graph?.getNodeOnPos(canvas.graph_mouse[0], canvas.graph_mouse[1])
    : canvas?.node_over
  if (!node || node.flags?.ghost) return

  const ctor = node.constructor as { title_mode?: 0 | 1 | 2 | 3 }
  const nodeType = node.type ?? ''
  const nodeDef = nodeDefStore.nodeDefsByName[nodeType]

  if (
    ctor.title_mode !== LiteGraph.NO_TITLE &&
    canvas.graph_mouse[1] < node.pos[1]
  ) {
    return showTooltip(
      resolveNodeDefText('description', nodeType, nodeDef?.description)
    )
  }

  if (node.flags?.collapsed) return

  const inputSlot = isOverNodeInput(
    node,
    canvas.graph_mouse[0],
    canvas.graph_mouse[1],
    [0, 0]
  )
  if (inputSlot !== -1) {
    const inputName = node.inputs[inputSlot].name
    return showTooltip(
      resolveNodeDefSlotText(
        'tooltip',
        nodeType,
        inputName,
        nodeDef?.inputs[inputName]?.tooltip
      )
    )
  }

  const outputSlot = isOverNodeOutput(
    node,
    canvas.graph_mouse[0],
    canvas.graph_mouse[1],
    [0, 0]
  )
  if (outputSlot !== -1) {
    return showTooltip(
      resolveNodeDefSlotText(
        'tooltip',
        nodeType,
        outputSlot,
        nodeDef?.outputs[outputSlot]?.tooltip
      )
    )
  }

  const widget = canvas.getWidgetAtCursor(node)
  if (widget && !isDOMWidget(widget)) {
    const translatedTooltip = resolveNodeDefSlotText(
      'tooltip',
      nodeType,
      widget.name,
      nodeDef?.inputs[widget.name]?.tooltip
    )
    return showTooltip(widget.tooltip ?? translatedTooltip)
  }
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    if (
      touchOrigin &&
      Math.hypot(event.clientX - touchOrigin.x, event.clientY - touchOrigin.y) >
        (useApp().canvas.node_widget ? 0 : 10)
    ) {
      hideTooltip()
    }
    return
  }
  hideTooltip()

  if (!(event.target instanceof HTMLCanvasElement) || event.buttons !== 0)
    return
  startIdle()
}

function onPointerDown(event: PointerEvent) {
  hideTooltip()
  if (
    event.pointerType !== 'touch' ||
    !(event.target instanceof HTMLCanvasElement)
  )
    return
  touchOrigin = { x: event.clientX, y: event.clientY }
  startIdle()
}

useEventListener(window, 'pointermove', onPointerMove, { capture: true })
useEventListener(window, 'pointerdown', onPointerDown, { capture: true })
useEventListener(
  window,
  ['pointerup', 'pointercancel'],
  (event) => {
    if (event.pointerType === 'touch') hideTooltip()
  },
  { capture: true }
)
useEventListener(window, ['click', 'wheel'], hideTooltip, {
  capture: true
})
</script>

<style lang="css" scoped>
.node-tooltip {
  pointer-events: none;
  background: var(--input);
  border-radius: 5px;
  box-shadow: 0 0 5px rgb(0 0 0 / 0.4);
  color: var(--foreground);
  left: 0;
  max-width: 30vw;
  padding: 4px 8px;
  position: absolute;
  top: 0;
  transform: translate(5px, calc(-100% - 5px));
  white-space: pre-wrap;
}
</style>
