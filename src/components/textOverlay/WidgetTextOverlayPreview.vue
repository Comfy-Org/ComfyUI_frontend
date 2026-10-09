<template>
  <div
    class="widget-expands flex size-full min-h-32 flex-col gap-1 overflow-hidden rounded-sm bg-base-background p-1"
    data-testid="text-overlay-preview"
  >
    <div
      ref="container"
      class="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
    >
      <canvas
        ref="canvasEl"
        class="block"
        :style="{ width: `${fit.width}px`, height: `${fit.height}px` }"
      />
    </div>
    <span
      v-if="!image"
      class="shrink-0 text-center text-xs text-muted-foreground"
    >
      {{ $t('textOverlay.runToPreview') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core'
import {
  computed,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import type {
  TextOverlayAlign,
  TextOverlayParams,
  TextOverlayPosition
} from '@/extensions/core/textOverlay/textOverlayCanvas'
import {
  drawTextOverlay,
  loadTextOverlayFont
} from '@/extensions/core/textOverlay/textOverlayCanvas'
import '@/extensions/core/textOverlay/assets/css/fonts.css'
import { useTextOverlaySources } from '@/renderer/extensions/vueNodes/widgets/composables/useTextOverlaySources'
import { useWidgetHostNode } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetHostNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'

const PLACEHOLDER_SIZE = 1024

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<null>
  nodeId: NodeId
}>()

const containerEl = useTemplateRef<HTMLDivElement>('container')
const canvasEl = useTemplateRef<HTMLCanvasElement>('canvasEl')
const { width: containerWidth, height: containerHeight } =
  useElementSize(containerEl)
const { pixelRatio } = useDevicePixelRatio()
const widgetValueStore = useWidgetValueStore()

const node = useWidgetHostNode(
  () => widget,
  () => nodeId
)

const { sourceUrl } = useTextOverlaySources(node)

const image = shallowRef<HTMLImageElement | null>(null)
watch(
  sourceUrl,
  (url, _, onCleanup) => {
    if (!url) {
      image.value = null
      return
    }
    let stale = false
    onCleanup(() => {
      stale = true
    })
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!stale) image.value = img
    }
    img.onerror = () => {
      if (!stale) image.value = null
    }
    img.src = url
  },
  { immediate: true }
)

function siblingValue(name: string): unknown {
  const host = node.value
  const graphId = host?.graph?.rootGraph.id
  if (!host || !graphId) return undefined
  return widgetValueStore.getWidget(widgetId(graphId, host.id, name))?.value
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T
): T {
  return options.find((option) => option === value) ?? fallback
}

const imageSize = computed(() => ({
  width: image.value?.naturalWidth || PLACEHOLDER_SIZE,
  height: image.value?.naturalHeight || PLACEHOLDER_SIZE
}))

function numberValue(name: string, fallback: number): number {
  const value = siblingValue(name)
  return typeof value === 'number' ? value : fallback
}

const params = computed((): TextOverlayParams => {
  const text = siblingValue('text')
  return {
    ...imageSize.value,
    text: typeof text === 'string' ? text : '',
    fontSize: numberValue('font_size', 5),
    position: oneOf<TextOverlayPosition>(
      siblingValue('position'),
      ['top', 'bottom'],
      'top'
    ),
    align: oneOf<TextOverlayAlign>(
      siblingValue('align'),
      ['left', 'center', 'right'],
      'left'
    ),
    outline: siblingValue('outline') !== false,
    paddingX: numberValue('padding_x', 1),
    paddingY: numberValue('padding_y', 1)
  }
})

const color = computed(() => {
  const value = siblingValue('color')
  return typeof value === 'string' && value ? value : '#ffffff'
})

const fit = computed(() => {
  const { width, height } = imageSize.value
  const scale = Math.min(
    containerWidth.value / width,
    containerHeight.value / height
  )
  if (!Number.isFinite(scale) || scale <= 0) return { width: 0, height: 0 }
  return { width: width * scale, height: height * scale }
})

const fontReady = ref(false)

function draw() {
  const canvas = canvasEl.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || !fit.value.width || !fontReady.value) return

  canvas.width = Math.max(1, Math.round(fit.value.width * pixelRatio.value))
  canvas.height = Math.max(1, Math.round(fit.value.height * pixelRatio.value))
  const { width, height } = imageSize.value
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (image.value) ctx.drawImage(image.value, 0, 0, width, height)
  drawTextOverlay(ctx, params.value, { color: color.value })
}

watch([params, color, image, fit, pixelRatio, fontReady], draw, {
  flush: 'post'
})

onMounted(() => {
  void loadTextOverlayFont().then((loaded) => {
    if (!loaded) console.warn('Text overlay preview font failed to load')
    fontReady.value = true
  })
})
</script>
