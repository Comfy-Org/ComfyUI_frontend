<template>
  <div ref="overlayRef" class="pointer-events-none fixed inset-0">
    <div class="pointer-events-auto absolute inset-0" :style="blockerStyle" />
    <div
      aria-hidden="true"
      data-testid="coach-spotlight"
      :class="
        cn(
          'pointer-events-none absolute rounded-[10px] motion-safe:transition-[left,top,width,height,opacity] motion-safe:duration-300',
          outlinePulsing &&
            'motion-safe:animate-[coach-pulse_1.2s_ease-in-out_infinite]'
        )
      "
      :style="[spotlightStyle, spotlightChrome]"
    />
    <div
      ref="cardRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="`${subtitleId} ${bodyId}`"
      class="pointer-events-auto absolute max-h-[calc(100vh-72px)] overflow-y-auto motion-safe:transition-[left,top] motion-safe:duration-300"
      :style="cardStyle"
    >
      <CoachmarkCard
        :subtitle="
          t('onboardingCoachmarks.stepLabel', {
            current: countedStepIdx + 1,
            total: countedStepsTotal
          })
        "
        :subtitle-id="subtitleId"
        :title="t(step.titleKey)"
        :title-id="titleId"
        :message="t(step.bodyKey)"
        :message-id="bodyId"
        :image="step.image"
      >
        <template #actions>
          <Button
            v-if="showSkip"
            variant="secondary"
            size="md"
            @click="emit('skip')"
          >
            {{ skipLabel }}
          </Button>
          <Button
            v-if="!expectsTargetInteraction"
            variant="inverted"
            size="md"
            @click="emit('advance')"
          >
            {{ primaryLabel }}
          </Button>
        </template>
      </CoachmarkCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener, useWindowSize } from '@vueuse/core'
import { ZIndex } from '@primeuix/utils/zindex'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onScopeDispose,
  ref,
  useId,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { MODAL_Z_BASE, MODAL_Z_KEY } from '@/components/dialog/vRekaZIndex'
import Button from '@/components/ui/button/Button.vue'

import CoachmarkCard from './CoachmarkCard.vue'
import {
  CARD_WIDTH,
  SCRIM_COLOR,
  SPOTLIGHT_PAD,
  VIEWPORT_MARGIN,
  blockerClipPath,
  clampSpotlight,
  noTargetCardLeft
} from './coachmarkLayout'
import type { CoachStep } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'
import { useFocusTrap } from './useFocusTrap'

// How long a user can stall on an interaction step before the outline pulses.
const PULSE_IDLE_MS = 4000

const {
  step,
  isLast,
  primaryLabel,
  skipLabel,
  countedStepIdx,
  countedStepsTotal,
  suspendFocusGuard
} = defineProps<{
  step: CoachStep
  isLast: boolean
  primaryLabel: string
  skipLabel: string
  countedStepIdx: number
  countedStepsTotal: number
  /** Suspends the focus pull-back while the engine awaits a deferred target. */
  suspendFocusGuard: boolean
}>()

const emit = defineEmits<{
  advance: []
  skip: []
}>()

const { t } = useI18n()
const bodyId = useId()
const subtitleId = useId()
const titleId = useId()

const overlayRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const { width: windowWidth, height: windowHeight } = useWindowSize()

const stepRef = computed<CoachStep | null>(() => step)
const { targetRect, targetEl, floatingStyles, isPositioned } =
  useCoachmarkTarget(stepRef, cardRef)

// Steps the user advances by interacting with the target (click/close), not Next.
const expectsTargetInteraction = computed(() => !!step.advanceOnTargetClick)
// Last step's "Done" already dismisses, so hide Skip unless the step has no primary button.
const showSkip = computed(() => !isLast || expectsTargetInteraction.value)

const focusTrap = useFocusTrap({
  cardRef,
  getTarget: () => targetEl.value,
  isSuspended: () => suspendFocusGuard,
  onEscape: () => emit('skip')
})

useEventListener(
  document,
  'click',
  (e: MouseEvent) => {
    if (!expectsTargetInteraction.value) return
    const target = targetEl.value
    if (target && e.composedPath().includes(target)) emit('advance')
  },
  { capture: true }
)

const pulsing = ref(false)
let pulseTimer: ReturnType<typeof setTimeout> | undefined
const outlinePulsing = computed(
  () => pulsing.value && expectsTargetInteraction.value
)

function schedulePulse() {
  clearTimeout(pulseTimer)
  pulsing.value = false
  if (!expectsTargetInteraction.value) return
  pulseTimer = setTimeout(() => {
    pulsing.value = true
  }, PULSE_IDLE_MS)
}
onScopeDispose(() => clearTimeout(pulseTimer))

async function raiseOverlay() {
  await nextTick()
  if (overlayRef.value) ZIndex.set(MODAL_Z_KEY, overlayRef.value, MODAL_Z_BASE)
}

// Reclaim the modal stack top (a deferred dialog may have registered above us),
// refocus the card, and reset the pulse whenever the step changes.
watch(
  () => step,
  () => {
    schedulePulse()
    void raiseOverlay()
    void focusTrap.focusCard()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (overlayRef.value) ZIndex.clear(overlayRef.value)
})

const viewport = () => ({
  width: windowWidth.value,
  height: windowHeight.value
})

// The white ring (outline) plus the giant spread shadow that dims everything
// outside the spotlight. The outline pulses via the coach-pulse keyframe.
const spotlightChrome = {
  outline: '2px solid #fff',
  boxShadow: `0 0 0 9999px ${SCRIM_COLOR}`
}

const spotlightStyle = computed(() => {
  const r = targetRect.value
  if (!r) return { opacity: '0' }
  return { ...clampSpotlight(r, SPOTLIGHT_PAD, viewport()), opacity: '1' }
})

// Eats pointer events everywhere (the spotlight's shadow does the dimming);
// interaction steps punch a hole at the target's bounds so only it stays clickable.
const blockerStyle = computed(() => {
  const r = targetRect.value
  // No target rect yet: the spotlight shadow isn't dimming anything, so dim here.
  if (!r) return { background: SCRIM_COLOR }
  if (!expectsTargetInteraction.value) return {}
  return { clipPath: blockerClipPath(r) }
})

const cardStyle = computed(() => {
  // Cap the width on viewports narrower than the card so it never overflows.
  const width = `${CARD_WIDTH}px`
  const maxWidth = `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`
  // No resolved target (a centred intro step, or a deferred target that hasn't
  // laid out): centre the card in the viewport rather than hide it.
  if (!targetEl.value) {
    return {
      width,
      maxWidth,
      left: `${noTargetCardLeft(windowWidth.value)}px`,
      top: '30%'
    }
  }
  // Floating UI places the card beside the target; stay hidden until it's
  // positioned to avoid a first-frame jump from the origin.
  return {
    ...floatingStyles.value,
    width,
    maxWidth,
    opacity: isPositioned.value ? '1' : '0'
  }
})
</script>

<style>
@keyframes coach-pulse {
  50% {
    outline-color: rgb(255 255 255 / 0.4);
  }
}
</style>
