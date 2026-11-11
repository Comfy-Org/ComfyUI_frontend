<template>
  <div
    data-testid="point-at-it-layer"
    class="pointer-events-none fixed inset-0 z-tour font-inter text-sm text-foreground"
  >
    <div
      v-if="blocksCanvas"
      data-testid="point-at-it-capture"
      :class="
        cn(
          'pointer-events-auto absolute inset-0 touch-none',
          canDraw && 'cursor-crosshair'
        )
      "
      @mousedown.prevent
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="session.releasePointer"
      @pointercancel="session.releasePointer"
    />
    <svg
      v-if="stroke.length > 0"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <polyline
        :points="strokePoints"
        class="fill-none stroke-primary"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        v-if="stroke.length < 3"
        :cx="stroke[0].x"
        :cy="stroke[0].y"
        r="6"
        class="fill-primary"
      />
    </svg>
    <p
      v-if="canDraw"
      role="status"
      class="absolute bottom-20 left-1/2 m-0 -translate-x-1/2 rounded-lg border border-border bg-background px-3 py-2 shadow-md"
    >
      {{ messages.markingHint }}
    </p>
    <AskBox
      v-if="state.phase === 'asking' || state.phase === 'thinking'"
      :anchor="state.mark.anchor"
      :chips="state.chips"
      :sent-question="state.phase === 'thinking' ? state.question : undefined"
      @remove-chip="session.removeChip"
      @ask="session.ask"
    />
    <GuidanceOverlay
      v-if="state.phase === 'guiding' && view"
      :step="state.steps[state.index]"
      :index="state.index"
      :total="state.steps.length"
      :edit-failed="state.editFailed"
      :view
      @apply-edit="session.applyOfferedEdit"
      @next="session.next"
      @done="session.finish"
      @close="session.dismiss"
    />
    <DemoControls
      v-model:reply-delay-ms="settings.replyDelayMs"
      v-model:wrong-target="settings.wrongTarget"
      v-model:held-key-entry="settings.heldKeyEntry"
      v-model:selection-entry="settings.selectionEntry"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import AskBox from './AskBox.vue'
import DemoControls from './DemoControls.vue'
import GuidanceOverlay from './GuidanceOverlay.vue'
import { messages } from './messages'
import type { PointHost } from './pointHost'
import { usePointSession } from './usePointSession'

const { host } = defineProps<{ host: PointHost }>()

const session = usePointSession(host)
const { state, view, settings } = session

const canDraw = computed(
  () =>
    state.value.phase === 'marking' ||
    (state.value.phase === 'armed' && state.value.canMark)
)
const blocksCanvas = computed(
  () => canDraw.value || state.value.phase === 'asking'
)
const stroke = computed(() => {
  if (state.value.phase === 'marking') return state.value.stroke
  return state.value.phase === 'asking' ? state.value.mark.stroke : []
})
const strokePoints = computed(() =>
  stroke.value.map((point) => `${point.x},${point.y}`).join(' ')
)

function onPointerDown(event: PointerEvent) {
  if (event.currentTarget instanceof Element)
    event.currentTarget.setPointerCapture(event.pointerId)
  session.pressPointer({ x: event.clientX, y: event.clientY })
}

function onPointerMove(event: PointerEvent) {
  session.movePointer({ x: event.clientX, y: event.clientY })
}
</script>
