<template>
  <div
    ref="transformPaneRef"
    data-testid="transform-pane"
    class="ph-no-capture pointer-events-none absolute inset-0 size-full will-change-auto"
  >
    <TooltipProvider
      :delay-duration="settingStore.get('LiteGraph.Node.TooltipDelay')"
      :skip-delay-duration="0"
    >
      <slot />
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import { useCompositedTransform } from '@/renderer/core/layout/transform/useCompositedTransform'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const settingStore = useSettingStore()

const { transformStyle, syncWithCanvas } = useTransformState()

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 256
})

const transformPaneRef = useTemplateRef('transformPaneRef')

const { setTransform: setPaneTransform } =
  useCompositedTransform(transformPaneRef)

watch(
  [transformStyle, transformPaneRef],
  ([{ transformOrigin, ...transform }, el]) => {
    if (!el) return
    el.style.transformOrigin = transformOrigin
    setPaneTransform(transform)
  }
)
watch([isInteracting, transformPaneRef], ([interacting, el]) => {
  if (el) {
    el.classList.toggle('will-change-transform', interacting)
    el.classList.toggle('will-change-auto', !interacting)
  }
})

watch(
  () => props.canvas,
  (canvas, _, onCleanup) => {
    if (!canvas) return
    syncWithCanvas(canvas)
    onCleanup(onCanvasFrame(canvas, 'present', () => syncWithCanvas(canvas)))
  },
  { immediate: true }
)
</script>
