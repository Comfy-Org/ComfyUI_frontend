<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import type { RelightImage } from '../../../composables/useRelight'
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
import EditorSplitLine from '../app-editor/EditorSplitLine.vue'
import { pointerFraction } from '../app-editor/stage-geometry'
import RelightCanvas from './RelightCanvas.vue'
import RelightLightDot from './RelightLightDot.vue'
import RelightMaskOutline from './RelightMaskOutline.vue'

const {
  image,
  lights,
  masks,
  scene,
  selected,
  comparing,
  handles,
  locale = 'en'
} = defineProps<{
  image: RelightImage
  lights: readonly Light[]
  masks: readonly RelightMask[]
  scene: RelightScene
  selected?: string
  comparing: boolean
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
const dragging = ref<string>()
const split = ref(50)

const point = (event: PointerEvent) => pointerFraction(event, frame.value)

function grab(light: Light, event: PointerEvent) {
  event.preventDefault()
  emit('select', light.id)
  emit('begin')
  frame.value?.setPointerCapture?.(event.pointerId)
  dragging.value = light.id
  const start = point(event)
  drag = (at) => {
    const moved = moveLight(light, at.x - start.x, at.y - start.y)
    emit('place', light.id, moved.x, moved.y)
  }
}

function release() {
  drag = undefined
  dragging.value = undefined
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
      class="relative isolate size-full touch-none select-none"
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
        :url="image.url"
        :lights
        :masks
        :scene
        :style="comparing ? { clipPath: `inset(0 0 0 ${split}%)` } : undefined"
      />
      <div
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
      >
        <RelightMaskOutline
          v-for="mask in masks.filter((candidate) => candidate.visible)"
          :key="mask.id"
          :mask
        />
      </div>
      <EditorSplitLine
        v-if="comparing"
        v-model="split"
        :before-label="lc('relight.view.original', locale)"
        :after-label="lc('relight.view.result', locale)"
        :slider-label="lc('relight.compare.live', locale)"
      />
      <template v-if="handles">
        <RelightLightDot
          v-for="light in lights"
          :key="light.id"
          :light
          :label="lc('relight.light.dot', locale, { name: light.name })"
          :selected="light.id === selected"
          :dragging="light.id === dragging"
          @grab="(event) => grab(light, event)"
          @nudge="(dx, dy) => nudge(light, dx, dy)"
          @focus="emit('select', light.id)"
        />
      </template>
      <slot />
    </div>
  </EditorFrame>
</template>
