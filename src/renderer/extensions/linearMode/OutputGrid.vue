<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import LatentPreview from '@/renderer/extensions/linearMode/LatentPreview.vue'
import type { ResultItemImpl } from '@/stores/queueStore'
import { resolveNode } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const {
  outputsByNode,
  outputCount,
  showSkeleton = false,
  builderMode = false,
  mobile = false
} = defineProps<{
  outputsByNode: Map<string, ResultItemImpl | undefined>
  outputCount: number
  showSkeleton?: boolean
  builderMode?: boolean
  mobile?: boolean
}>()

const emit = defineEmits<{
  reorder: [fromIndex: number, toIndex: number]
  openLightbox: [url: string]
}>()

const AREA_NAMES = ['a', 'b', 'c', 'd']

const MEDIA_TYPE_META: Record<string, { label: string; icon: string }> = {
  images: { label: 'Image', icon: 'icon-[lucide--image]' },
  video: { label: 'Video', icon: 'icon-[lucide--film]' },
  audio: { label: 'Audio', icon: 'icon-[lucide--volume-2]' },
  text: { label: 'Text', icon: 'icon-[lucide--file-text]' },
  gltf: { label: '3D', icon: 'icon-[lucide--box]' }
}

function getOutputLabel(
  nodeId: string,
  index: number
): { label: string; icon: string } {
  const node = resolveNode(Number(nodeId))
  if (!node)
    return { label: `Output ${index + 1}`, icon: 'icon-[lucide--layout-grid]' }

  const comfyClass = node.comfyClass ?? ''
  if (comfyClass.toLowerCase().includes('image') || comfyClass === 'SaveImage')
    return { label: node.title || 'Image', icon: MEDIA_TYPE_META.images.icon }
  if (comfyClass.toLowerCase().includes('video'))
    return { label: node.title || 'Video', icon: MEDIA_TYPE_META.video.icon }
  if (comfyClass.toLowerCase().includes('audio'))
    return { label: node.title || 'Audio', icon: MEDIA_TYPE_META.audio.icon }
  if (
    comfyClass.toLowerCase().includes('3d') ||
    comfyClass.toLowerCase().includes('gltf')
  )
    return { label: node.title || '3D', icon: MEDIA_TYPE_META.gltf.icon }
  if (comfyClass.toLowerCase().includes('text'))
    return { label: node.title || 'Text', icon: MEDIA_TYPE_META.text.icon }

  return {
    label: node.title || `Output ${index + 1}`,
    icon: 'icon-[lucide--layout-grid]'
  }
}

// Matches p-2 and gap-2 on the grid container
const GRID_PADDING_PX = 8
const GRID_GAP_PX = 8
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

const rowRatio = ref(0.5)
const colRatio = ref(0.5)
const gridRef = useTemplateRef('gridRef')
const isResizing = ref(false)

/** CSS calc() — exactly centered in the gap between grid rows/columns. */
function cssSplitPos(ratio: number) {
  const totalPad = GRID_PADDING_PX * 2
  const pct = ratio * 100
  return `calc(${GRID_PADDING_PX}px + (100% - ${totalPad + GRID_GAP_PX}px) * ${pct / 100} + ${GRID_GAP_PX / 2}px)`
}

const rowHandleCssTop = computed(() => cssSplitPos(rowRatio.value))
const colHandleCssLeft = computed(() => cssSplitPos(colRatio.value))

/** For 3 outputs, horizontal handle only spans the left column. */
const rowHandleWidth = computed(() => {
  if (outputCount !== 3) return '100%'
  const totalPad = GRID_PADDING_PX * 2
  const pct = colRatio.value * 100
  return `calc((100% - ${totalPad + GRID_GAP_PX}px) * ${pct / 100} + ${GRID_PADDING_PX}px)`
})

function gridStyleForCount(count: number) {
  const r = rowRatio.value
  const c = colRatio.value
  switch (count) {
    case 2:
      return { gridTemplate: `"a" ${r}fr "b" ${1 - r}fr / 1fr` }
    case 3:
      return {
        gridTemplate: `"a c" ${r}fr "b c" ${1 - r}fr / ${c}fr ${1 - c}fr`
      }
    case 4:
      return {
        gridTemplate: `"a b" ${r}fr "c d" ${1 - r}fr / ${c}fr ${1 - c}fr`
      }
    default:
      return { gridTemplate: '"a" 1fr / 1fr' }
  }
}

const gridStyle = computed(() => {
  if (mobile) {
    const rows = AREA_NAMES.slice(0, outputCount)
      .map((a) => `"${a}" 1fr`)
      .join(' ')
    return { gridTemplate: `${rows} / 1fr` }
  }
  return gridStyleForCount(outputCount)
})

function startResize(
  ratioRef: { value: number },
  axis: 'row' | 'col',
  e: MouseEvent
) {
  e.preventDefault()
  isResizing.value = true
  const startPos = axis === 'row' ? e.clientY : e.clientX
  const startRatio = ratioRef.value
  const container = gridRef.value
  if (!container) return
  const size = axis === 'row' ? container.clientHeight : container.clientWidth

  function onMouseMove(ev: MouseEvent) {
    const pos = axis === 'row' ? ev.clientY : ev.clientX
    const delta = pos - startPos
    ratioRef.value = Math.max(
      MIN_RATIO,
      Math.min(MAX_RATIO, startRatio + delta / size)
    )
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onRowResizeStart(e: MouseEvent) {
  startResize(rowRatio, 'row', e)
}

function onColResizeStart(e: MouseEvent) {
  startResize(colRatio, 'col', e)
}

const cells = computed(() => {
  const nodeIds = [...outputsByNode.keys()]
  return nodeIds.slice(0, 4).map((nodeId, i) => {
    const meta = getOutputLabel(nodeId, i)
    return {
      nodeId,
      label: meta.label,
      icon: meta.icon,
      output: outputsByNode.get(nodeId),
      area: AREA_NAMES[i]
    }
  })
})

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragFromIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(index: number, e: DragEvent) {
  e.preventDefault()
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(index: number) {
  if (dragFromIndex.value !== null && dragFromIndex.value !== index) {
    emit('reorder', dragFromIndex.value, index)
  }
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}
</script>
<template>
  <div
    ref="gridRef"
    :class="
      cn(
        'relative grid min-h-0 flex-1 gap-2 overflow-hidden p-2',
        builderMode &&
          'pt-[calc(var(--workflow-tabs-height)+var(--spacing)*18)]',
        isResizing && 'select-none'
      )
    "
    :style="gridStyle"
  >
    <div
      v-for="(cell, index) in cells"
      :key="cell.nodeId"
      :class="
        cn(
          'relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg',
          builderMode
            ? 'border-2 border-dashed border-warning-background'
            : 'border border-border-subtle',
          dragOverIndex === index && 'ring-2 ring-primary-background'
        )
      "
      :style="{ gridArea: cell.area }"
      :draggable="builderMode"
      @dragstart="builderMode && onDragStart(index, $event)"
      @dragover="builderMode && onDragOver(index, $event)"
      @dragleave="builderMode && onDragLeave()"
      @drop="builderMode && onDrop(index)"
      @dragend="builderMode && onDragEnd()"
      @dblclick="
        !mobile && cell.output?.url && emit('openLightbox', cell.output.url)
      "
      @click="
        mobile && cell.output?.url && emit('openLightbox', cell.output.url)
      "
    >
      <div
        v-if="builderMode || !cell.output"
        class="text-xxs absolute top-0 left-0 z-10 flex items-center gap-1.5 rounded-br-lg bg-base-background/80 px-2.5 py-1 text-muted-foreground"
      >
        <i :class="cn(cell.icon, 'size-3')" />
        {{ cell.label }}
      </div>

      <MediaOutputPreview
        v-if="cell.output"
        :output="cell.output"
        :mobile
        class="size-full object-contain"
      />
      <LatentPreview v-else-if="showSkeleton" />
      <div
        v-else
        class="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
      >
        <i :class="cn(cell.icon, 'size-8 opacity-30')" />
        <span v-if="builderMode" class="text-xs opacity-50">
          {{ t('linearMode.arrange.resultsLabel') }}
        </span>
      </div>
      <div v-if="mobile && cell.output" class="absolute inset-0 z-10" />
    </div>
    <!-- Horizontal resize handle (row split) -->
    <div
      v-if="outputCount >= 2 && !builderMode && !mobile"
      class="absolute left-0 z-20 h-2 cursor-row-resize"
      :style="{ top: rowHandleCssTop, width: rowHandleWidth }"
      @mousedown="onRowResizeStart"
    >
      <div
        :class="
          cn(
            'mx-auto h-px w-full bg-border-subtle/30 transition-colors',
            isResizing && 'bg-border-subtle'
          )
        "
      />
    </div>
    <!-- Vertical resize handle (column split) -->
    <div
      v-if="outputCount >= 3 && !builderMode && !mobile"
      class="absolute top-0 z-20 h-full w-2 cursor-col-resize"
      :style="{ left: colHandleCssLeft }"
      @mousedown="onColResizeStart"
    >
      <div
        :class="
          cn(
            'my-auto h-full w-px bg-border-subtle/30 transition-colors',
            isResizing && 'bg-border-subtle'
          )
        "
      />
    </div>
  </div>
</template>
