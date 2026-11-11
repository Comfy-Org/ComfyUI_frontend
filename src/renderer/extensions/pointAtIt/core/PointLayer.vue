<template>
  <div
    data-point-at-it-layer
    data-testid="point-at-it-layer"
    class="pointer-events-none fixed inset-0 z-tour font-inter text-sm text-foreground"
    @pointerdown.stop
    @mousedown.stop
    @pointerup.stop
    @mouseup.stop
    @click.stop
  >
    <div
      v-if="blocksPage"
      data-point-at-it-surface
      data-testid="point-at-it-capture"
      :class="
        cn(
          'pointer-events-auto absolute inset-0 touch-none',
          (canDraw || isPicking) && 'cursor-crosshair'
        )
      "
      @mousedown.prevent
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="session.releasePointer"
      @pointercancel="session.releasePointer"
      @pointerleave="session.leavePointer"
      @wheel="onWheel"
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
    <div
      v-if="hover"
      data-testid="point-at-it-hover"
      class="absolute rounded-md outline-2 outline-offset-2 outline-primary outline-dashed"
      :style="rectStyle(hover.rect)"
    />
    <div
      v-if="draft && draftAnchor"
      data-testid="point-at-it-comment-target"
      class="absolute rounded-md ring-2 ring-primary"
      :style="rectStyle(draftAnchor)"
    />
    <template v-for="pin in pins" :key="pin.id">
      <Button
        v-if="pin.rect"
        variant="primary"
        size="unset"
        class="pointer-events-auto absolute size-6 -translate-1/2 rounded-full text-xs shadow-md"
        :style="{ left: `${pin.rect.x}px`, top: `${pin.rect.y}px` }"
        :disabled="!canEditPins"
        :aria-label="messages.pinLabel(pin.number, labelOf(pin.id))"
        @click="session.openPin(pin.id)"
      >
        {{ pin.number }}
      </Button>
    </template>
    <CommentBox
      v-if="draft"
      :key="draftKey"
      :anchor="draftAnchor ?? windowCentre"
      :draft
      :target-note="draftTargetNote"
      @save="session.saveDraft"
      @remove="session.deleteDraft"
      @close="session.dismiss"
    />
    <AskBox
      v-if="state.phase === 'asking'"
      :anchor="state.mark.anchor"
      :chips="state.chips"
      @remove-chip="session.removeChip"
      @ask="session.ask"
    />
    <AskBox
      v-else-if="state.phase === 'waiting' && state.asked"
      :anchor="state.asked.mark.anchor"
      :chips="state.asked.chips"
      :sent-question="state.asked.question"
    />
    <GuidanceOverlay
      v-if="state.phase === 'guiding' && view"
      :step="state.steps[state.index]"
      :index="state.index"
      :total="state.steps.length"
      :edit-failed="state.editFailed"
      :answers="answeredComment"
      :view
      @apply-edit="session.applyOfferedEdit"
      @next="session.next"
      @done="session.finish"
      @close="session.dismiss"
    />
    <AnnotationTray
      class="pointer-events-auto absolute bottom-4 left-16 w-72"
      :annotations
      :pins
      :thinking
      :phase="state.phase"
      :waiting-since="state.phase === 'waiting' ? state.startedAt : null"
      :failure="state.phase === 'failed' ? state.failure : null"
      @toggle="session.toggleAnnotate"
      @open="session.openPin"
      @send="session.sendBatch"
      @clear="session.clearAnnotations"
      @cancel="session.dismiss"
      @retry="session.retry"
    />
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import AnnotationTray from './AnnotationTray.vue'
import AskBox from './AskBox.vue'
import CommentBox from './CommentBox.vue'
import type { PointConfig } from './config'
import type { Rect } from './geometry'
import GuidanceOverlay from './GuidanceOverlay.vue'
import { messages } from './messages'
import type { PointHost } from './pointHost'
import { addressKey } from './targetAddress'
import { usePointSession } from './usePointSession'

const { host, config } = defineProps<{
  host: PointHost
  config: PointConfig
}>()

const session = usePointSession(host, { config })
const { state, annotations, thinking, view, pins, hover, draftAnchor } = session
const windowSize = useWindowSize()

const canDraw = computed(
  () => state.value.phase === 'armed' || state.value.phase === 'marking'
)
const draft = computed(() =>
  state.value.phase === 'annotating' ? state.value.draft : null
)
const isPicking = computed(
  () => state.value.phase === 'annotating' && !draft.value
)
const blocksPage = computed(
  () =>
    canDraw.value ||
    state.value.phase === 'asking' ||
    state.value.phase === 'annotating'
)
const canEditPins = computed(
  () =>
    state.value.phase === 'idle' ||
    state.value.phase === 'failed' ||
    isPicking.value
)
const stroke = computed(() => {
  if (state.value.phase === 'marking') return state.value.stroke
  return state.value.phase === 'asking' ? state.value.mark.stroke : []
})
const strokePoints = computed(() =>
  stroke.value.map((point) => `${point.x},${point.y}`).join(' ')
)
const windowCentre = computed<Rect>(() => ({
  x: windowSize.width.value / 2,
  y: windowSize.height.value / 2,
  width: 0,
  height: 0
}))
const draftKey = computed(() => {
  if (!draft.value) return ''
  const { annotationId, targets } = draft.value
  return annotationId ?? targets.map(addressKey).join('|')
})
const draftTargetNote = computed(() => {
  if (!draft.value?.annotationId || draftAnchor.value) return ''
  const pin = pins.value.find((candidate) => candidate.id === draftKey.value)
  return pin?.missing ? messages.targetGoneNote : messages.targetHiddenNote
})
const answeredComment = computed(() => {
  if (state.value.phase !== 'guiding') return null
  const { annotationId } = state.value.steps[state.value.index]
  const index = annotations.value.findIndex(
    (annotation) => annotation.id === annotationId
  )
  return index < 0
    ? null
    : { number: index + 1, label: annotations.value[index].label }
})

function labelOf(annotationId: string): string {
  return (
    annotations.value.find((annotation) => annotation.id === annotationId)
      ?.label ?? ''
  )
}

function rectStyle(rect: Rect) {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  }
}

function onPointerDown(event: PointerEvent) {
  if (!canDraw.value) return
  if (event.currentTarget instanceof Element)
    event.currentTarget.setPointerCapture(event.pointerId)
  session.pressPointer({ x: event.clientX, y: event.clientY })
}

function onPointerMove(event: PointerEvent) {
  session.movePointer({ x: event.clientX, y: event.clientY })
}

function onWheel(event: WheelEvent) {
  if (state.value.phase === 'annotating') session.passWheel(event)
}
</script>
