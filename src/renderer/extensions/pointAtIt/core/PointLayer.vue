<template>
  <Teleport :to="slot" :disabled="!isDocked">
    <div
      ref="triggerBox"
      :class="
        cn(
          'flex shrink-0 items-center font-inter text-xs text-foreground',
          !isDocked && 'fixed top-2 right-2 z-tour'
        )
      "
    >
      <TriggerButton
        :active="state.phase === 'annotating'"
        :disabled="!canToggle"
        :panel-open="panelOpen"
        :unsent="conversation.unsent.length"
        :waiting-since="waitingSince"
        @toggle="session.pressTrigger"
        @caret="session.pressCaret"
      />
    </div>
  </Teleport>
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
      :style="{ clipPath: clipAround(triggerRect) }"
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
    <template v-for="pin in shownPins" :key="pin.id">
      <Button
        v-if="pin.rect"
        :variant="pin.locked ? 'secondary' : 'primary'"
        size="unset"
        :class="
          cn(
            'pointer-events-auto absolute size-6 -translate-1/2 rounded-full text-xs shadow-md',
            pin.locked && 'border border-solid border-border opacity-70'
          )
        "
        :style="{ left: `${pin.rect.x}px`, top: `${pin.rect.y}px` }"
        :disabled="pin.locked ? !canReplay : !canEditPins"
        :aria-label="
          pin.locked
            ? messages.answeredPinLabel(pin.number, labelOf(pin.id))
            : messages.pinLabel(pin.number, labelOf(pin.id))
        "
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
      :unsent-count="conversation.unsent.length"
      :send-block="sendBlock"
      :avoid="panelRect"
      :target-note="draftTargetNote"
      @save="session.saveDraft"
      @send="session.sendFromDraft"
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
      :thread="threadBefore"
      :follow-up="state.followUp"
      :thinking
      :replay="state.replay"
      :avoid="panelRect"
      :view
      @apply-edit="session.applyOfferedEdit"
      @next="session.next"
      @done="session.finish"
      @close="session.dismiss"
      @follow-up="session.followUp"
      @cancel-follow-up="session.cancelFollowUp"
      @retry-follow-up="session.retryFollowUp"
    />
    <div
      v-if="stripText"
      data-testid="point-at-it-strip"
      class="pointer-events-auto absolute flex w-80 items-center gap-1 rounded-lg border border-solid border-border bg-background p-1 text-xs shadow-md"
      :style="{ left: `${panelPlace.x}px`, top: `${panelPlace.y}px` }"
    >
      <Button
        variant="textonly"
        size="unset"
        :class="
          cn(
            'min-w-0 flex-1 justify-start rounded-md px-1 text-left',
            state.phase === 'failed'
              ? 'text-destructive'
              : 'text-muted-foreground'
          )
        "
        :aria-label="messages.showPanel"
        @click="session.openPanel"
      >
        <span role="status" class="truncate">{{ stripText }}</span>
      </Button>
      <Button v-if="state.phase === 'failed'" size="sm" @click="session.retry">
        {{ messages.retry }}
      </Button>
    </div>
    <TurnStrip
      v-if="turnItems.length > 0"
      ref="turnStrip"
      class="pointer-events-auto absolute"
      :style="{ left: `${turnStripPlace.x}px`, top: `${turnStripPlace.y}px` }"
      :items="turnItems"
      :shown-turn-id="answeredTurnId"
      :disabled="!canReplay"
      @open="session.openPin"
      @open-panel="session.openPanel"
    />
    <CommentPanel
      v-if="panelOpen"
      ref="panel"
      class="pointer-events-auto absolute w-80"
      :style="{
        left: `${panelPlace.x}px`,
        top: `${panelPlace.y}px`,
        maxHeight: `${panelPlace.maxHeight}px`
      }"
      :conversation
      :pins
      :thinking
      :phase="state.phase"
      :waiting-since="waitingSince"
      :failure="state.phase === 'failed' ? state.failure : null"
      :send-block="sendBlock"
      :held="isHeld"
      @collapse="session.collapsePanel"
      @open="session.openPin"
      @send="session.sendBatch"
      @clear="session.clearUnsent"
      @start-over="session.startOver"
      @cancel="session.dismiss"
      @retry="session.retry"
    />
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useRafFn, useWindowSize } from '@vueuse/core'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import AskBox from './AskBox.vue'
import CommentBox from './CommentBox.vue'
import CommentPanel from './CommentPanel.vue'
import type { PointConfig } from './config'
import { keepDocked } from './dockSlot'
import { clipAround, placePanel, placeStrip } from './geometry'
import type { Rect } from './geometry'
import GuidanceOverlay from './GuidanceOverlay.vue'
import { describeFailure, messages } from './messages'
import type { PointHost } from './pointHost'
import { waitsOnFollowUp } from './pointState'
import { addressKey } from './targetAddress'
import TriggerButton from './TriggerButton.vue'
import TurnStrip from './TurnStrip.vue'
import { turnOfAnswer, turnStripItems } from './turnGrouping'
import { messagesBefore, numberedComments, threadOf } from './turns'
import { usePointSession } from './usePointSession'

const { host, config } = defineProps<{
  host: PointHost
  config: PointConfig
}>()

const PANEL_WIDTH = 320
const STRIP_TAIL_CHARS = 60
const LAYER_ATTRIBUTE = 'data-point-at-it-layer'

const session = usePointSession(host, { config })
const {
  state,
  conversation,
  thinking,
  view,
  pins,
  hover,
  draftAnchor,
  panelOpen,
  sendBlock
} = session
const isHeld = computed(() => waitsOnFollowUp(state.value))
const comments = computed(() => numberedComments(conversation.value))
const windowSize = useWindowSize()

const slot = document.createElement('div')
slot.setAttribute(LAYER_ATTRIBUTE, '')
slot.className = 'flex shrink-0 items-center'
const isDocked = shallowRef(false)
const triggerBox = useTemplateRef('triggerBox')
const triggerRect = shallowRef<Rect | null>(null)
const canvasRect = shallowRef<Rect>({ x: 0, y: 0, width: 0, height: 0 })
const panel = useTemplateRef('panel')
const panelSize = useElementSize(() => panel.value?.$el, undefined, {
  box: 'border-box'
})
const turnStrip = useTemplateRef('turnStrip')
const turnStripSize = useElementSize(() => turnStrip.value?.$el, undefined, {
  box: 'border-box'
})

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
const waitingSince = computed(() => {
  const current = state.value
  if (current.phase === 'waiting') return current.startedAt
  return current.phase === 'guiding' && current.followUp?.status === 'waiting'
    ? current.followUp.startedAt
    : null
})
const canToggle = computed(
  () =>
    state.value.phase === 'idle' ||
    state.value.phase === 'annotating' ||
    state.value.phase === 'failed' ||
    (state.value.phase === 'guiding' && !isHeld.value)
)
const panelPlace = computed(() =>
  placePanel(
    triggerRect.value ?? {
      x: windowSize.width.value - PANEL_WIDTH,
      y: 0,
      width: PANEL_WIDTH,
      height: 40
    },
    PANEL_WIDTH,
    canvasRect.value,
    { width: windowSize.width.value, height: windowSize.height.value }
  )
)
const panelRect = computed<Rect | null>(() =>
  panelOpen.value
    ? {
        x: panelPlace.value.x,
        y: panelPlace.value.y,
        width: PANEL_WIDTH,
        height: panelSize.height.value
      }
    : null
)
const turnItems = computed(() =>
  turnStripItems(conversation.value, config.turnStrip)
)
const answeredTurnId = computed(() =>
  turnOfAnswer(conversation.value, answeredId.value)
)
const turnStripPlace = computed(() =>
  placeStrip(
    canvasRect.value,
    { width: turnStripSize.width.value, height: turnStripSize.height.value },
    { width: windowSize.width.value, height: windowSize.height.value },
    panelRect.value
  )
)
const stripText = computed(() => {
  if (panelOpen.value) return ''
  if (state.value.phase === 'failed')
    return describeFailure(state.value.failure)
  if (state.value.phase !== 'waiting') return ''
  const tail = thinking.value?.text.trim().slice(-STRIP_TAIL_CHARS) ?? ''
  return tail ? `${messages.thinking} · …${tail}` : messages.askWaiting
})
const needsMeasuring = computed(
  () =>
    panelOpen.value ||
    stripText.value !== '' ||
    blocksPage.value ||
    turnItems.value.length > 0
)

function sameRect(a: Rect | null, b: Rect): boolean {
  return (
    a !== null &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  )
}

function measure(): void {
  const box = triggerBox.value?.getBoundingClientRect()
  if (box) {
    const rect = {
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height
    }
    if (!sameRect(triggerRect.value, rect)) triggerRect.value = rect
  }
  const canvas = host.viewport()
  if (!sameRect(canvasRect.value, canvas)) canvasRect.value = canvas
}

const measuring = useRafFn(measure, { immediate: false })
watch(
  needsMeasuring,
  (needed) => {
    if (needed) measuring.resume()
    else measuring.pause()
  },
  { immediate: true }
)

let undock: (() => void) | undefined
onMounted(() => {
  undock = keepDocked(
    slot,
    () => host.topBarPlace(slot),
    (docked) => {
      isDocked.value = docked
    }
  )
})
onBeforeUnmount(() => undock?.())

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
const answeredId = computed(() =>
  state.value.phase === 'guiding'
    ? state.value.steps[state.value.index].annotationId
    : null
)
const shownPins = computed(() =>
  pins.value.filter(
    (pin) =>
      pin.id !== answeredId.value && (!pin.locked || config.showEarlierPins)
  )
)
const canReplay = computed(
  () =>
    state.value.phase === 'idle' ||
    state.value.phase === 'failed' ||
    (state.value.phase === 'guiding' && !isHeld.value) ||
    isPicking.value
)
const threadBefore = computed(() => {
  if (state.value.phase !== 'guiding') return null
  const step = state.value.steps[state.value.index]
  const thread = step.annotationId
    ? threadOf(conversation.value, step.annotationId)
    : null
  return thread ? messagesBefore(thread, step.ref) : null
})
const answeredComment = computed(() => {
  const annotationId = answeredId.value
  const answered = comments.value.find(
    (comment) => comment.annotation.id === annotationId
  )
  return answered
    ? { number: answered.number, label: answered.annotation.label }
    : null
})

function labelOf(annotationId: string): string {
  return (
    comments.value.find((comment) => comment.annotation.id === annotationId)
      ?.annotation.label ?? ''
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
