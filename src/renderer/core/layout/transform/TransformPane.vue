<template>
  <div
    data-testid="transform-pane"
    :class="cn('absolute inset-0 w-full h-full pointer-events-none')"
    :style="transformStyle"
  >
    <!-- Vue nodes will be rendered here -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { cn } from '@/utils/tailwindUtil'

interface TransformPaneProps {
  canvas?: LGraphCanvas
}

const props = defineProps<TransformPaneProps>()

const { transformStyle, syncWithCanvas } = useTransformState()

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
