<template>
  <div
    :class="
      cn(
        WidgetInputBaseClass,
        'flex w-full items-center justify-center gap-2 px-2',
        useWidgetHeight()
      )
    "
    :data-widget-name="widget.name"
  >
    <template v-if="resolution">
      <span class="text-xs" data-testid="resolution-preview-value">
        {{ resolution.width }} × {{ resolution.height }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{ resolution.mpLabel }}
      </span>
    </template>
    <span v-else class="text-xs text-muted-foreground"> — </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { getNodeWidgetValue } from '@/core/graph/widgets/nodeWidgetValues'
import type { IWidgetResolutionPreviewOptions } from '@/lib/litegraph/src/types/widgets'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useWidgetHeight } from '@/types/widgetTypes'
import { resolveNode } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<null, IWidgetResolutionPreviewOptions>
  nodeId?: NodeId
}>()

const { t } = useI18n()

const hostNode = computed(() =>
  nodeId === undefined ? undefined : resolveNode(nodeId)
)

// Python round() ties to even; Math.round ties up.
function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  if (value - floor !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

// Mirrors ResolutionSelector.execute in comfy_extras/nodes_resolution.py —
// keep the math in sync with the backend.
const resolution = computed(() => {
  const node = hostNode.value
  if (!node) return null
  const ratioRaw = getNodeWidgetValue(
    node,
    widget.options?.ratio_widget ?? 'aspect_ratio'
  )
  const mpRaw = getNodeWidgetValue(
    node,
    widget.options?.megapixels_widget ?? 'megapixels'
  )
  const multipleRaw = getNodeWidgetValue(
    node,
    widget.options?.multiple_widget ?? 'multiple'
  )

  const match =
    typeof ratioRaw === 'string' ? /^(\d+)\s*:\s*(\d+)/.exec(ratioRaw) : null
  const megapixels = typeof mpRaw === 'number' ? mpRaw : NaN
  if (!match || !Number.isFinite(megapixels) || megapixels <= 0) return null

  const multiple =
    typeof multipleRaw === 'number' && multipleRaw > 0 ? multipleRaw : 8
  const wRatio = Number(match[1])
  const hRatio = Number(match[2])
  const scale = Math.sqrt((megapixels * 1024 * 1024) / (wRatio * hRatio))
  const width = roundHalfToEven((wRatio * scale) / multiple) * multiple
  const height = roundHalfToEven((hRatio * scale) / multiple) * multiple
  if (!width || !height) return null

  return {
    width,
    height,
    mpLabel: t('g.megapixelsValue', {
      count: ((width * height) / (1024 * 1024)).toFixed(2)
    })
  }
})
</script>
