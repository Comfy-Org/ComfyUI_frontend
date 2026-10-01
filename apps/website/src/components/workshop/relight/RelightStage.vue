<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type { RelightImage, RelightView } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type {
  Light,
  RelightMask,
  RelightScene
} from '../../../lib/workshop/relight/lights'
import { moveLight } from '../../../lib/workshop/relight/lights'
import { RELIGHT_EXAMPLE } from '../../../lib/workshop/relight/mock-run'
import EditorFrame from '../app-editor/EditorFrame.vue'
import RelightCanvas from './RelightCanvas.vue'
import RelightLightDot from './RelightLightDot.vue'
import RelightMaskOutline from './RelightMaskOutline.vue'

const {
  image,
  lights,
  masks,
  scene,
  selected,
  view,
  handles,
  locale = 'en'
} = defineProps<{
  image: RelightImage
  lights: readonly Light[]
  masks: readonly RelightMask[]
  scene: RelightScene
  selected?: string
  view: RelightView
  handles: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  begin: []
  place: [id: string, x: number, y: number]
  nudge: [id: string, x: number, y: number]
}>()

const frame = useTemplateRef<HTMLElement>('frame')
let drag: ((at: { x: number; y: number }) => void) | undefined

function point(event: PointerEvent) {
  const box = frame.value?.getBoundingClientRect()
  if (!box?.width || !box.height) return { x: 0, y: 0 }
  return {
    x: (event.clientX - box.left) / box.width,
    y: (event.clientY - box.top) / box.height
  }
}

function grab(light: Light, event: PointerEvent) {
  event.preventDefault()
  emit('select', light.id)
  emit('begin')
  frame.value?.setPointerCapture?.(event.pointerId)
  const start = point(event)
  drag = (at) => {
    const moved = moveLight(light, at.x - start.x, at.y - start.y)
    emit('place', light.id, moved.x, moved.y)
  }
}

function release() {
  drag = undefined
}

function nudge(light: Light, dx: number, dy: number) {
  const moved = moveLight(light, dx, dy)
  emit('nudge', light.id, moved.x, moved.y)
}
</script>

<template>
  <EditorFrame :width="image.width" :height="image.height">
    <div
      ref="frame"
      class="relative size-full touch-none select-none"
      data-testid="relight-stage"
      @pointermove="drag?.(point($event))"
      @pointerup="release"
      @pointercancel="release"
    >
      <img
        :src="image.url"
        :alt="
          image.url === RELIGHT_EXAMPLE.url
            ? lc('relight.alt.example', locale)
            : image.name
        "
        draggable="false"
        class="pointer-events-none size-full rounded-sm object-cover"
      />
      <RelightCanvas
        v-show="view !== 'original'"
        :url="image.url"
        :lights
        :masks
        :scene
        :light-map="view === 'lightmap'"
      />
      <RelightMaskOutline
        v-for="mask in masks.filter((candidate) => candidate.visible)"
        :key="mask.id"
        :mask
      />
      <template v-if="handles">
        <RelightLightDot
          v-for="light in lights"
          :key="light.id"
          :light
          :label="lc('relight.light.dot', locale, { name: light.name })"
          :selected="light.id === selected"
          @grab="(event) => grab(light, event)"
          @nudge="(dx, dy) => nudge(light, dx, dy)"
          @focus="emit('select', light.id)"
        />
      </template>
    </div>
  </EditorFrame>
</template>
