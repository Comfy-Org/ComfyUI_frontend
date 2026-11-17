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
      :avoid="askRect"
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
    <Companion
      v-if="config.companion"
      ref="her"
      :look="companion"
      :dock
      :stand="standing?.position ?? null"
      :points="standing?.points ?? 'right'"
      :speech
      :avoid="speechAvoid"
      :title="companionTitle"
      :disabled="role === 'mode' && !canToggle"
      :accessible-as="companionAccess"
      :reacts="config.hoverReactions"
      @press="pressCompanion"
      @enter="menu.herEntered"
      @leave="menu.herLeft"
    />
    <CompanionTips
      v-if="tipsShown"
      :anchor="dockHead"
      :options="cardChoices"
      :takes-focus="menu.pinned.value"
      @send="sendMessage"
      @point="startAsking"
      @close="closeCard"
      @enter="menu.cardEntered"
      @leave="menu.cardLeft"
      @engage="menu.engaged"
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
      :thinking="config.companion ? null : thinking"
      :avoid="askRect"
      :attach-to="replyAnchor"
      :view
      :show-pointer="!config.companion"
      @placed="onCardPlaced"
      @apply-edit="session.applyOfferedEdit"
      @next="session.next"
      @done="session.finish"
      @follow-up="session.followUp"
      @cancel-follow-up="session.cancelFollowUp"
      @retry-follow-up="session.retryFollowUp"
    />
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
    <p
      v-if="history?.unsaved.value"
      data-testid="point-at-it-unsaved"
      role="status"
      class="pointer-events-none absolute m-0 -translate-x-1/2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-destructive shadow-md"
      :style="{ top: `${unsavedTop}px`, left: `${askPlace.centerX}px` }"
    >
      {{ historyNotice.notSaved }}
    </p>
    <div
      ref="askColumn"
      data-testid="point-at-it-ask"
      class="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-2 font-inter text-xs text-foreground"
      :style="{ left: `${askPlace.centerX}px`, bottom: `${askPlace.bottom}px` }"
    >
      <AskSlot
        v-if="askSlot.kind !== 'none'"
        class="pointer-events-auto"
        :style="
          askSlot.kind === 'summary' ? undefined : { width: `${slotSize}px` }
        "
        :view="askSlot"
        :conversation
        :pins
        :phase="state.phase"
        :failure="state.phase === 'failed' ? state.failure : null"
        :thinking
        :send-block="sendBlock"
        :held="isHeld"
        :cap="dockLimit"
        @collapse="session.collapsePanel"
        @expand="session.pressCaret"
        @open="session.openPin"
        @send="session.sendBatch"
        @clear="session.clearUnsent"
        @start-over="session.startOver"
        @cancel="session.dismiss"
        @retry="session.retry"
        @taller="session.toggleTaller"
      />
      <div
        v-if="stripShown"
        class="pointer-events-auto flex items-center rounded-lg bg-background shadow-md"
      >
        <TriggerButton
          :active="state.phase === 'annotating'"
          :disabled="role === 'mode' && !canToggle"
          :role
          :panel-open="panelOpen"
          :unsent="conversation.unsent.length"
          :waiting-since="waitingSince"
          @toggle="session.pressTrigger"
          @caret="session.pressCaret"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useRafFn, useWindowSize } from '@vueuse/core'
import {
  computed,
  inject,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import AskBox from './AskBox.vue'
import AskSlot from './AskSlot.vue'
import CommentBox from './CommentBox.vue'
import Companion from './Companion.vue'
import {
  COMPANION_FINGERTIPS,
  COMPANION_FINGER_GAP,
  COMPANION_SIZE,
  companionHead
} from './companionArt'
import { cardOptions } from './cardOptions'
import CompanionTips from './CompanionTips.vue'
import { companionLook, withCompanion } from './companionPose'
import type { PointedTarget } from './companionPose'
import type { PointConfig } from './config'
import {
  dockCap,
  isInView,
  placeAsk,
  placeDock,
  placeStanding,
  placeStrip,
  slotWidth
} from './geometry'
import type { Rect } from './geometry'
import GuidanceOverlay from './GuidanceOverlay.vue'
import { HISTORY_KEEPER } from './historyKeeper'
import { historyNotice } from './historyNotice'
import { messages } from './messages'
import type { PointHost } from './pointHost'
import { waitsOnFollowUp } from './pointState'
import { askName, askPressed, askTitle, slotView } from './slotView'
import { addressKey } from './targetAddress'
import { waitingLine } from './thoughtLine'
import TriggerButton from './TriggerButton.vue'
import TurnStrip from './TurnStrip.vue'
import { turnOfAnswer, turnStripItems } from './turnGrouping'
import { messagesBefore, numberedComments, threadOf } from './turns'
import { useCompanionMenu } from './useCompanionMenu'
import type { CardDismissal, PressSource } from './useCompanionMenu'
import { usePointSession } from './usePointSession'

const { host, config } = defineProps<{
  host: PointHost
  config: PointConfig
}>()

const UNSAVED_TOP_GAP = 8

const history = inject(HISTORY_KEEPER, null)
const session = usePointSession(host, { config })
const {
  state,
  conversation,
  thinking,
  view,
  pins,
  hover,
  draftAnchor,
  panelState,
  panelOpen,
  askButton: role,
  sendBlock
} = session
const isHeld = computed(() => waitsOnFollowUp(state.value))
const comments = computed(() => numberedComments(conversation.value))
const windowSize = useWindowSize()

const canvasRect = shallowRef<Rect>(host.viewport())
const askColumn = useTemplateRef('askColumn')
const askSize = useElementSize(askColumn, undefined, { box: 'border-box' })
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
/** The follow-up that was sent from the answer on screen and has no reply yet. */
const followUpWaiting = computed(() => {
  const current = state.value
  return current.phase === 'guiding' && current.followUp?.status === 'waiting'
    ? current.followUp
    : null
})
const waitingSince = computed(() => {
  const current = state.value
  if (current.phase === 'waiting') return current.startedAt
  return followUpWaiting.value?.startedAt ?? null
})
const canToggle = computed(
  () =>
    state.value.phase === 'idle' ||
    state.value.phase === 'annotating' ||
    state.value.phase === 'failed' ||
    (state.value.phase === 'guiding' && !isHeld.value)
)
const viewportSize = computed(() => ({
  width: windowSize.width.value,
  height: windowSize.height.value
}))
const askPlace = computed(() => placeAsk(canvasRect.value, viewportSize.value))
const slotSize = computed(() => slotWidth(canvasRect.value, viewportSize.value))
const dockLimit = computed(() => dockCap(canvasRect.value, viewportSize.value))
const unsavedTop = computed(() => canvasRect.value.y + UNSAVED_TOP_GAP)
const slotContent = computed(() =>
  slotView({
    panel: panelState.value,
    phase: state.value.phase,
    hasDraft: draft.value !== null,
    unsent: conversation.value.unsent.length,
    thinking: thinking.value
  })
)
const askRect = computed<Rect>(() => ({
  x: askPlace.value.centerX - askSize.width.value / 2,
  y: windowSize.height.value - askPlace.value.bottom - askSize.height.value,
  width: askSize.width.value,
  height: askSize.height.value
}))
const askSlot = computed(() =>
  config.companion ? withCompanion(slotContent.value).slot : slotContent.value
)
/** Without her the strip is the only entry; with her, only when the config keeps it. */
const stripShown = computed(() => !config.companion || config.askStrip)
/**
 * Pressed while nothing is going on, she opens her card, where she is spoken
 * to; at any other time she is Ask.
 */
const offersTips = computed(() => state.value.phase === 'idle')
/** Whether her card is open and whether it is pinned: by a click, a key, or resting the pointer on her. */
const menu = useCompanionMenu({
  canOffer: () => config.companion && offersTips.value,
  hover: config.hoverMenu
})
const tipsShown = computed(
  () => config.companion && offersTips.value && menu.open.value
)
/** What her card offers is read when it opens: pressing the canvas closes it, so the selection cannot change while it is open. */
const cardChoices = shallowRef(cardOptions([], []))
watch(
  tipsShown,
  (shown) => {
    if (shown)
      cardChoices.value = cardOptions(host.readNodes(), host.readSelection())
  },
  { flush: 'sync', immediate: true }
)
const her = useTemplateRef('her')
/** While her card is on offer it is the hint, so she has no tooltip to stack on it. */
const companionTitle = computed(() => {
  if (!offersTips.value) return askTitle(role.value)
  return config.hoverMenu ? undefined : messages.tipsTooltip
})
/** Where there is no strip to be the Ask button, she is the control for assistive technology. */
const companionAccess = computed(() => {
  if (stripShown.value) return null
  if (offersTips.value)
    return { name: messages.tipsLabel, expanded: tipsShown.value }
  return {
    name: askName(role.value),
    pressed: askPressed(role.value, {
      annotating: state.value.phase === 'annotating'
    })
  }
})

function pressCompanion(source: PressSource): void {
  if (offersTips.value) menu.pressed(source)
  else session.pressTrigger()
}

/**
 * Esc and its close button put her card away, and so does a press elsewhere.
 * A card that was opened from the keyboard hands the keyboard back to her,
 * except after a press elsewhere; one opened with the pointer does not, or her
 * focus ring would show on a button that was only ever clicked.
 */
function closeCard(by: CardDismissal): void {
  const handsBack = by !== 'outside' && menu.byKeyboard.value
  menu.close()
  if (handsBack) her.value?.focusButton()
}

/** From her card: say this to her. The card goes, and she thinks about it. */
function sendMessage(text: string): void {
  menu.close()
  session.sendMessage(text)
}

/** From her card: ask by pointing at something instead of typing. */
function startAsking(): void {
  menu.close()
  session.startAsking('')
}
/** She stands where the canvas draws its info lines, so they go while she is on. */
watchEffect((onCleanup) => {
  if (config.companion && config.hideCanvasInfo)
    onCleanup(host.hideCanvasInfo())
})
/**
 * What the companion says, when she is the one who says it: the waiting line
 * of the request that is out, whether it is the first or a follow-up, and the
 * Ask hint while Ask waits for a click. A follow-up's line is its own
 * thinking, never the answer's before it.
 */
const speech = computed(() => {
  if (!config.companion) return null
  const waiting = followUpWaiting.value
  if (waiting) {
    const own = thinking.value?.requestId === waiting.requestId
    return waitingLine(own ? thinking.value : null)
  }
  const says = withCompanion(slotContent.value).says
  if (says === 'waiting') return waitingLine(thinking.value)
  return says === 'hint' ? messages.annotateHint : null
})
const pointedTarget = computed<PointedTarget>(() => {
  const current = state.value
  if (current.phase !== 'guiding') return 'none'
  if (current.steps[current.index].target === null) return 'none'
  const ring = view.value?.ring
  return ring && isInView(ring, canvasRect.value) ? 'shown' : 'hidden'
})
const companion = computed(() =>
  companionLook({
    phase: state.value.phase,
    target: pointedTarget.value,
    followUpWaiting: followUpWaiting.value !== null
  })
)
const dock = computed(() =>
  placeDock(canvasRect.value, COMPANION_SIZE, viewportSize.value)
)
const dockHead = computed(() => companionHead(dock.value))
/**
 * An answer that points at nothing is her reply, said where she is at home:
 * its card is attached to her head, with its tail. Nothing else gives the card
 * a place, because there is no ring.
 */
const replyAnchor = computed(() =>
  config.companion && pointedTarget.value === 'none' ? dockHead.value : null
)
/** Where the answer's card is, so that she stands on a side it does not use. */
const guidanceCard = shallowRef<Rect | null>(null)
/** What her speech keeps off: the ring she points at, or her own card when she is at home. */
const speechAvoid = computed(
  () => view.value?.ring ?? (replyAnchor.value ? guidanceCard.value : null)
)
const standing = computed(() => {
  const ring = view.value?.ring
  if (!ring) return null
  return placeStanding(ring, COMPANION_SIZE, viewportSize.value, {
    order: ['right', 'left'],
    avoid: [guidanceCard.value, askRect.value],
    fingertips: COMPANION_FINGERTIPS,
    gap: COMPANION_FINGER_GAP
  })
})
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
    askRect.value
  )
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

function onCardPlaced(card: Rect | null): void {
  if (card === null || !sameRect(guidanceCard.value, card))
    guidanceCard.value = card
}

function measure(): void {
  const canvas = host.viewport()
  if (!sameRect(canvasRect.value, canvas)) canvasRect.value = canvas
}

useRafFn(measure)
onMounted(measure)

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
  if (!pin) return ''
  return pin.missing ? messages.targetGoneNote : messages.targetHiddenNote
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
  if (!thread) return null
  const isOriginalStep = step.ref !== null && step.ref.followUpId === null
  return state.value.replay || !isOriginalStep
    ? messagesBefore(thread, step.ref)
    : []
})
const answeredComment = computed(() => {
  const annotationId = answeredId.value
  const answered = comments.value.find(
    (comment) => comment.annotation.id === annotationId
  )
  return answered && answered.number !== null
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
