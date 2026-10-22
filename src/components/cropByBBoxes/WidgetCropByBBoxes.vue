<template>
  <div
    ref="containerEl"
    class="widget-expands relative size-full overflow-hidden rounded-[5px] bg-node-component-surface"
    :style="{ minHeight: `${IMAGE_PREVIEW_CONTENT_MIN_HEIGHT}px` }"
  >
    <div
      v-if="!sourceUrl"
      class="flex size-full flex-col items-center justify-center text-center"
      data-testid="crop-empty-state"
    >
      <i class="mb-2 icon-[lucide--image] size-12" />
      <p class="text-sm">
        {{
          imageConnected
            ? $t('cropByBBoxes.runToPreview')
            : $t('imageCrop.noInputImage')
        }}
      </p>
    </div>

    <template v-else>
      <canvas
        ref="canvasEl"
        :aria-label="$t('imageCrop.cropPreviewAlt')"
        role="img"
        class="absolute inset-0 size-full"
      />
      <p
        v-if="!union"
        class="absolute inset-x-0 bottom-0 m-0 bg-node-component-surface/80 p-1 text-center text-xs"
        data-testid="crop-bboxes-hint"
      >
        {{
          incomingBoxes
            ? $t('cropByBBoxes.noBoxes')
            : $t('cropByBBoxes.runToPreview')
        }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useImage } from '@vueuse/core'
import { computed, useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  cropRegion,
  outputFrame,
  outputSizeFrame,
  unionBounds
} from '@/components/cropByBBoxes/cropByBBoxesGeometry'
import type { KeepAspect } from '@/components/cropByBBoxes/cropByBBoxesGeometry'
import { renderCropByBBoxesPreview } from '@/components/cropByBBoxes/drawCropByBBoxesPreview'
import type { CropPreviewScene } from '@/components/cropByBBoxes/drawCropByBBoxesPreview'
import { useIncomingBoundingBoxes } from '@/renderer/extensions/vueNodes/widgets/composables/useIncomingBoundingBoxes'
import { useInputImageSource } from '@/renderer/extensions/vueNodes/widgets/composables/useInputImageSource'
import { IMAGE_PREVIEW_CONTENT_MIN_HEIGHT } from '@/renderer/extensions/vueNodes/components/imagePreviewLayout'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<null>
  nodeId: NodeId
}>()

const { t } = useI18n()

const node = computed(() => {
  const locatorId = widget.nodeLocatorId
  const owner = locatorId && getNodeByLocatorId(app.rootGraph, locatorId)
  return owner || app.canvas.graph?.getNodeById(nodeId)
})

function widgetValue(name: string): unknown {
  return node.value?.widgets?.find((w) => w.name === name)?.value
}

function widgetNumber(name: string, fallback: number): number {
  const value = widgetValue(name)
  return typeof value === 'number' ? value : fallback
}

const { connected: imageConnected, url: sourceUrl } = useInputImageSource(
  node,
  'image',
  'source_images',
  { preferSaved: true }
)
const incomingBoxes = useIncomingBoundingBoxes(node, 'bboxes', 'input_bboxes')
const union = computed(() =>
  incomingBoxes.value ? unionBounds(incomingBoxes.value) : undefined
)

const { state: image } = useImage(() => ({ src: sourceUrl.value ?? '' }))

const scene = computed<CropPreviewScene | undefined>(() => {
  const img = image.value
  if (!sourceUrl.value || !img?.naturalWidth) return undefined

  const imageWidth = img.naturalWidth
  const imageHeight = img.naturalHeight
  const base = {
    image: img,
    imageWidth,
    imageHeight,
    boxes: incomingBoxes.value ?? []
  }
  if (!union.value) return base

  const region = cropRegion(
    union.value,
    widgetNumber('padding', 0),
    imageWidth,
    imageHeight
  )
  const output = {
    width: widgetNumber('output_width', 512),
    height: widgetNumber('output_height', 512)
  }
  const keepAspect: KeepAspect =
    widgetValue('keep_aspect') === 'pad' ? 'pad' : 'stretch'
  return {
    ...base,
    crop: {
      region,
      frame: outputFrame(region, output, keepAspect),
      sizeFrame:
        keepAspect === 'stretch' ? outputSizeFrame(region, output) : undefined,
      cropLabel: t('cropByBBoxes.cropSize', {
        width: region.width,
        height: region.height
      }),
      outputLabel: t('cropByBBoxes.outputSize', {
        ...output,
        mode: keepAspect
      })
    }
  }
})

const containerEl = useTemplateRef<HTMLDivElement>('containerEl')
const canvasEl = useTemplateRef<HTMLCanvasElement>('canvasEl')
const { width, height } = useElementSize(containerEl)

watchEffect(
  () => {
    const el = canvasEl.value
    const current = scene.value
    if (!el || !current || !width.value || !height.value) return

    renderCropByBBoxesPreview(el, width.value, height.value, current)
  },
  { flush: 'post' }
)
</script>
