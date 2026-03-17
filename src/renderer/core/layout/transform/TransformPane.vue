<template>
  <div
    ref="transformPaneRef"
    data-testid="transform-pane"
    class="pointer-events-none absolute inset-0 size-full will-change-auto"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, useTemplateRef, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useTransformSettling } from '@/renderer/core/layout/transform/useTransformSettling'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const { transformStyle, syncWithCanvas } = useTransformState()

const canvasElement = computed(() => props.canvas?.canvas)
const { isTransforming: isInteracting } = useTransformSettling(canvasElement, {
  settleDelay: 256
})

const transformPaneRef = useTemplateRef('transformPaneRef')

/**
 * Apply transform style and will-change class via direct DOM mutation
 * instead of reactive template bindings (:style / :class).
 *
 * These values change every animation frame during zoom or pan.
 * If they were bound in the template, Vue would diff the entire
 * TransformPane vnode—including all child node slots—on every frame,
 * causing expensive vdom patch work across the full node list.
 * Mutating the DOM directly limits the update to a single element.
 */

watch([transformStyle, transformPaneRef], ([newStyle, el]) => {
  if (el) {
    Object.assign(el.style, newStyle)
  }
})
watch([isInteracting, transformPaneRef], ([interacting, el]) => {
  if (el) {
    el.classList.toggle('will-change-transform', interacting)
    el.classList.toggle('will-change-auto', !interacting)
  }
})

useRafFn(
  () => {
    if (!props.canvas) {
      return
    }
    syncWithCanvas(props.canvas)
  },
  { immediate: true }
)
</script>
