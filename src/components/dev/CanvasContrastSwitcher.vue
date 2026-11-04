<template>
  <aside
    class="pointer-events-auto fixed right-4 bottom-4 z-blocking flex flex-col gap-2 rounded-lg border border-[#7d7d7d40] bg-[#111111cc] px-3 py-2 font-inter text-xs text-white backdrop-blur-sm"
    data-testid="canvas-contrast-switcher"
    @pointerdown.stop
    @focusin.stop
  >
    <label class="flex items-center justify-between gap-2">
      <span class="font-medium">{{
        $t('canvasContrastPrototype.canvas')
      }}</span>
      <select
        v-model="canvasId"
        class="h-7 cursor-pointer rounded-md border border-[#7d7d7d40] bg-[#1a1a1a] px-2 font-inter text-xs text-white"
      >
        <option
          v-for="option in CANVAS_OPTIONS"
          :key="option.id"
          :value="option.id"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="flex items-center justify-between gap-2">
      <span class="font-medium">{{ $t('canvasContrastPrototype.nodes') }}</span>
      <select
        v-model="nodesId"
        class="h-7 cursor-pointer rounded-md border border-[#7d7d7d40] bg-[#1a1a1a] px-2 font-inter text-xs text-white"
      >
        <option
          v-for="option in NODE_OPTIONS"
          :key="option.id"
          :value="option.id"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
  </aside>
</template>

<script setup lang="ts">
import { useIntervalFn, useStyleTag, useUrlSearchParams } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const CANVAS_OPTIONS = [
  { id: 'current', label: 'Current · #141414 + #222 grid', hex: null },
  { id: '950', label: '950 · #09090a', hex: '#09090a' },
  { id: '900', label: '900 · #18181a', hex: '#18181a' },
  { id: '800', label: '800 · #272729', hex: '#272729' },
  { id: '700', label: '700 · #3f3f44', hex: '#3f3f44' }
] as const

const NODE_OPTIONS = [
  {
    id: 'current',
    label: 'Current · header 950 · body 900 · widgets 800',
    header: null,
    body: null,
    widgets: null
  },
  {
    id: 'h950-b800-w700',
    label: 'Header 950 · body 800 · widgets 700',
    header: '#09090a',
    body: '#272729',
    widgets: '#3f3f44'
  },
  {
    id: 'h800-b950-w800',
    label: 'Header 800 · body 950 · widgets 800',
    header: '#272729',
    body: '#09090a',
    widgets: '#272729'
  },
  {
    id: 'h950-b950-w800',
    label: 'Header 950 · body 950 · widgets 800',
    header: '#09090a',
    body: '#09090a',
    widgets: '#272729'
  }
] as const

const TILE_BASE = 34

const params = useUrlSearchParams('history')

const canvasId = computed({
  get: () =>
    CANVAS_OPTIONS.find((option) => option.id === params.canvas)?.id ??
    CANVAS_OPTIONS[0].id,
  set: (id: string) => {
    params.canvas = id === CANVAS_OPTIONS[0].id ? '' : id
  }
})

const nodesId = computed({
  get: () =>
    NODE_OPTIONS.find((option) => option.id === params.nodes)?.id ??
    NODE_OPTIONS[0].id,
  set: (id: string) => {
    params.nodes = id === NODE_OPTIONS[0].id ? '' : id
  }
})

const activeNodes = computed(
  () => NODE_OPTIONS.find((o) => o.id === nodesId.value) ?? NODE_OPTIONS[0]
)

useStyleTag(
  computed(() => {
    const n = activeNodes.value
    if (!n.body || useColorPaletteStore().activePaletteId !== 'dark') return ''
    return `:root { --node: ${n.body} !important; --node-header: ${n.header} !important; } [data-node-id] { --input: ${n.widgets} !important; --secondary: ${n.widgets} !important; }`
  }),
  { id: 'canvas-contrast-nodes' }
)

const colorPaletteStore = useColorPaletteStore()
const canvasStore = useCanvasStore()

async function linesOnlyTile(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  const tile = document.createElement('canvas')
  tile.width = image.width
  tile.height = image.height
  const ctx = tile.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, tile.width, tile.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const darkness = Math.max(0, TILE_BASE - pixels.data[i])
    pixels.data[i] = 0
    pixels.data[i + 1] = 0
    pixels.data[i + 2] = 0
    pixels.data[i + 3] = Math.round((darkness / 39) * 255)
  }
  ctx.putImageData(pixels, 0, 0)
  return tile.toDataURL()
}

const activeCanvas = computed(
  () => CANVAS_OPTIONS.find((o) => o.id === canvasId.value) ?? CANVAS_OPTIONS[0]
)

useStyleTag(
  computed(() =>
    activeCanvas.value.hex && colorPaletteStore.activePaletteId === 'dark'
      ? `body { background-color: ${activeCanvas.value.hex} !important; }`
      : ''
  ),
  { id: 'canvas-contrast-canvas' }
)

let tileFor = ''
let tileUrl = ''

async function applyCanvas() {
  const canvas = canvasStore.canvas
  if (!canvas || colorPaletteStore.activePaletteId !== 'dark') return
  const base = colorPaletteStore.completedActivePalette.colors.litegraph_base
  const originalImage = base.BACKGROUND_IMAGE ?? canvas.background_image
  const originalClear = base.CLEAR_BACKGROUND_COLOR ?? '#141414'
  const option = activeCanvas.value
  if (option.hex && tileFor !== originalImage) {
    tileUrl = await linesOnlyTile(originalImage)
    tileFor = originalImage
  }
  const wantImage = option.hex ? tileUrl : originalImage
  const wantClear = option.hex ? 'transparent' : originalClear
  if (
    canvas.background_image === wantImage &&
    canvas.clear_background_color === wantClear
  )
    return
  canvas.background_image = wantImage
  canvas.clear_background_color = wantClear
  canvas._pattern = undefined
  canvas.setDirty(true, true)
}

watch(
  [canvasId, () => colorPaletteStore.activePaletteId, () => canvasStore.canvas],
  () => void applyCanvas(),
  { immediate: true }
)

useIntervalFn(() => void applyCanvas(), 1000)
</script>
