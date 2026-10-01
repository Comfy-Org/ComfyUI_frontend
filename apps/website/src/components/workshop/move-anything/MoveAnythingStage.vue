<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref, useTemplateRef } from 'vue'

import type { Locale } from '../../../i18n/translations'
import type {
  Corner,
  MoveObject,
  Rect
} from '../../../lib/workshop/move-anything/arrange'
import {
  MIN_SIZE,
  isMoved,
  moveRect,
  rectBetween,
  resizeRect
} from '../../../lib/workshop/move-anything/arrange'
import { mc } from '../../../lib/workshop/move-anything/copy'
import { MOVE_EXAMPLE } from '../../../lib/workshop/move-anything/mock-run'
import type { MoveImage, MoveTool } from '../../../composables/useMoveAnything'
import EditorFrame from '../app-editor/EditorFrame.vue'
import MoveAnythingBox from './MoveAnythingBox.vue'

const {
  image,
  objects,
  tool,
  selected,
  locale = 'en'
} = defineProps<{
  image: MoveImage
  objects: readonly MoveObject[]
  tool: MoveTool
  selected?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  begin: []
  place: [id: string, to: Rect]
  add: [from: Rect]
}>()

const frame = useTemplateRef<HTMLElement>('frame')
const drawing = ref<Rect>()
let gesture: (move: { x: number; y: number }) => void = () => {}

function point(event: PointerEvent) {
  const box = frame.value?.getBoundingClientRect()
  if (!box?.width || !box.height) return { x: 0, y: 0 }
  return {
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height
  }
}

function track(
  event: PointerEvent,
  onMove: (at: { x: number; y: number }) => void
) {
  frame.value?.setPointerCapture?.(event.pointerId)
  gesture = onMove
}

function grab(object: MoveObject, event: PointerEvent, corner?: Corner) {
  if (tool !== 'move') return
  event.preventDefault()
  emit('select', object.id)
  emit('begin')
  const start = point(event)
  const from = object.to
  track(event, (at) => {
    const dx = at.x - start.x
    const dy = at.y - start.y
    emit(
      'place',
      object.id,
      corner ? resizeRect(from, corner, dx, dy) : moveRect(from, dx, dy)
    )
  })
}

function startDraw(event: PointerEvent) {
  if (tool !== 'add') return
  const start = point(event)
  drawing.value = rectBetween(start, start)
  track(event, (at) => (drawing.value = rectBetween(start, at)))
}

function finish() {
  gesture = () => {}
  const drawn = drawing.value
  drawing.value = undefined
  if (drawn && drawn.w > MIN_SIZE && drawn.h > MIN_SIZE) emit('add', drawn)
}

function nudge(object: MoveObject, dx: number, dy: number) {
  emit('begin')
  emit('place', object.id, moveRect(object.to, dx, dy))
}

const boxStyle = (rect: Rect) => ({
  left: `${rect.x * 100}%`,
  top: `${rect.y * 100}%`,
  width: `${rect.w * 100}%`,
  height: `${rect.h * 100}%`
})
</script>

<template>
  <EditorFrame :width="image.width" :height="image.height">
    <div
      ref="frame"
      :class="
        cn(
          'relative size-full touch-none select-none',
          tool === 'add' && 'cursor-crosshair'
        )
      "
      data-testid="move-stage"
      @pointerdown.self="startDraw"
      @pointermove="gesture(point($event))"
      @pointerup="finish"
      @pointercancel="finish"
    >
      <img
        :src="image.url"
        :alt="
          image.url === MOVE_EXAMPLE.url
            ? mc('move.alt.example', locale)
            : image.name
        "
        draggable="false"
        class="pointer-events-none size-full rounded-sm object-cover"
      />
      <span
        v-for="object in objects.filter(isMoved)"
        :key="`ghost-${object.id}`"
        class="pointer-events-none absolute rounded-sm border-[1.5px] border-dashed border-primary-comfy-yellow/60 bg-primary-comfy-yellow/5"
        :style="boxStyle(object.from)"
        aria-hidden="true"
      />
      <MoveAnythingBox
        v-for="(object, index) in objects"
        :key="object.id"
        :rect="object.to"
        :n="index + 1"
        :label="object.label"
        :description="mc('move.object.box', locale, { label: object.label })"
        :selected="object.id === selected"
        @grab="(event, corner) => grab(object, event, corner)"
        @nudge="(dx, dy) => nudge(object, dx, dy)"
        @focus="emit('select', object.id)"
      />
      <span
        v-if="drawing"
        class="pointer-events-none absolute rounded-sm border-[1.5px] border-dashed border-primary-comfy-yellow bg-primary-comfy-yellow/10"
        :style="boxStyle(drawing)"
        aria-hidden="true"
      />
    </div>
  </EditorFrame>
</template>
