<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { Play } from '@lucide/vue'

import { computed, onUnmounted, reactive, ref } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'
import CameraNode from './CameraNode.vue'
import GraphLinks from './GraphLinks.vue'
import ImageEditNode from './ImageEditNode.vue'
import LoadImageNode from './LoadImageNode.vue'
import SaveImageNode from './SaveImageNode.vue'
import type { NodeKey } from './graphLayout'
import { GRAPH, NODE_KEYS } from './graphLayout'

const canvasEl = ref<HTMLElement>()

const result = ref<string | null>(null)
const running = ref(false)
const lastRunPose = ref<typeof DEFAULT_POSE | null>(null)
let runTimer: ReturnType<typeof setTimeout> | null = null

const dirty = computed(
  () =>
    !lastRunPose.value ||
    lastRunPose.value.azimuth !== pose.azimuth ||
    lastRunPose.value.elevation !== pose.elevation ||
    lastRunPose.value.zoom !== pose.zoom
)

function run() {
  if (running.value) return
  running.value = true
  const delay = prefersReducedMotion() ? 0 : 650
  runTimer = setTimeout(() => {
    result.value = resolveAsset(pose).src
    lastRunPose.value = { ...pose }
    running.value = false
  }, delay)
}

onUnmounted(() => {
  if (runTimer) clearTimeout(runTimer)
})

const positions = reactive(
  Object.fromEntries(
    NODE_KEYS.map((key) => [
      key,
      { x: GRAPH.nodes[key].left, y: GRAPH.nodes[key].top }
    ])
  ) as Record<NodeKey, { x: number; y: number }>
)

const collapsed = reactive<Record<NodeKey, boolean>>({
  load: false,
  camera: false,
  edit: false,
  save: false
})

const zOrder = ref<NodeKey[]>([...NODE_KEYS])

const pose = reactive({ ...DEFAULT_POSE })

interface DragState {
  key: NodeKey
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  emPx: number
}

const drag = ref<DragState | null>(null)

function bringToFront(key: NodeKey) {
  zOrder.value = [...zOrder.value.filter((k) => k !== key), key]
}

function onPointerDown(key: NodeKey, event: PointerEvent) {
  bringToFront(key)
  const target = event.target as Element
  if (
    target.closest(
      'button, select, input, a, label, [role="slider"], [data-camera-scene]'
    )
  )
    return
  const canvas = canvasEl.value
  if (!canvas) return
  drag.value = {
    key,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: positions[key].x,
    originY: positions[key].y,
    emPx: Number.parseFloat(getComputedStyle(canvas).fontSize)
  }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  const state = drag.value
  if (!state || event.pointerId !== state.pointerId) return
  const node = GRAPH.nodes[state.key]
  const x = state.originX + (event.clientX - state.startX) / state.emPx
  const y = state.originY + (event.clientY - state.startY) / state.emPx
  positions[state.key].x = Math.min(
    GRAPH.canvas.width - node.width + 1,
    Math.max(-1, x)
  )
  positions[state.key].y = Math.min(
    GRAPH.canvas.height - (collapsed[state.key] ? 2.25 : node.height),
    Math.max(0, y)
  )
}

function onPointerUp(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) drag.value = null
}

function wrapperStyle(key: NodeKey) {
  return {
    left: `${positions[key].x}em`,
    top: `${positions[key].y}em`,
    width: `${GRAPH.nodes[key].width}em`,
    zIndex: zOrder.value.indexOf(key) + 1
  }
}
</script>

<template>
  <div class="@container">
    <div
      ref="canvasEl"
      :class="cn('relative mx-auto', drag && 'cursor-grabbing select-none')"
      :style="{
        width: `${GRAPH.canvas.width}em`,
        height: `${GRAPH.canvas.height}em`,
        fontSize: `min(${100 / GRAPH.canvas.width}cqw, 1rem)`
      }"
    >
      <GraphLinks :positions :collapsed />
      <div
        v-for="key in NODE_KEYS"
        :key="key"
        :class="
          cn(
            'absolute touch-none',
            drag?.key === key ? 'cursor-grabbing' : 'cursor-grab'
          )
        "
        :style="wrapperStyle(key)"
        @pointerdown="onPointerDown(key, $event)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <LoadImageNode
          v-if="key === 'load'"
          v-model:collapsed="collapsed.load"
        />
        <CameraNode
          v-else-if="key === 'camera'"
          v-model:collapsed="collapsed.camera"
          v-model:azimuth="pose.azimuth"
          v-model:elevation="pose.elevation"
          v-model:zoom="pose.zoom"
        />
        <ImageEditNode
          v-else-if="key === 'edit'"
          v-model:collapsed="collapsed.edit"
          :result="result"
          :running="running"
        />
        <SaveImageNode
          v-else
          v-model:collapsed="collapsed.save"
          :result="result"
          :running="running"
        />
      </div>
    </div>

    <div class="mt-6 flex justify-center">
      <button
        type="button"
        :disabled="running"
        :class="
          cn(
            'bg-primary-comfy-yellow inline-flex cursor-pointer items-center gap-2 rounded-2xl px-8 py-3 font-bold tracking-wider text-primary-comfy-ink uppercase transition-opacity',
            'focus-visible:ring-primary-comfy-yellow/50 outline-none focus-visible:ring-2',
            running ? 'opacity-70' : 'hover:opacity-90'
          )
        "
        @click="run"
      >
        <Play class="size-4 fill-current" aria-hidden="true" />
        <span class="ppformula-text-center">
          {{ running ? 'Running' : dirty ? 'Run' : 'Run again' }}
        </span>
      </button>
    </div>
  </div>
</template>
