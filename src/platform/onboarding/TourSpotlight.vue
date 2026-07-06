<template>
  <div ref="overlayRef" class="pointer-events-none fixed inset-0">
    <div
      :class="
        cn(
          'pointer-events-auto absolute inset-0',
          !targetRect && 'bg-coach-scrim'
        )
      "
      :style="blockerStyle"
    />
    <div
      aria-hidden="true"
      data-testid="coach-spotlight"
      :class="
        cn(
          'pointer-events-none absolute rounded-[10px] shadow-[0_0_0_9999px_var(--color-coach-scrim)] outline-2 outline-coach-ring motion-safe:transition-[left,top,width,height,opacity] motion-safe:duration-300',
          outlinePulsing && 'motion-safe:animate-coach-pulse'
        )
      "
      :style="spotlightStyle"
    />
    <div
      ref="cardRef"
      role="dialog"
      :aria-modal="!expectsTargetInteraction"
      :aria-labelledby="titleId"
      :aria-describedby="`${subtitleId} ${bodyId}`"
      class="pointer-events-auto absolute max-h-[calc(100vh-var(--comfy-topbar-height)-2rem)] overflow-y-auto motion-safe:transition-[left,top] motion-safe:duration-300"
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
        :title
        :title-id="titleId"
        :message="body"
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
            :disabled="waitingForTarget"
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
  SPOTLIGHT_PAD,
  VIEWPORT_MARGIN,
  blockerClipPath,
  clampSpotlight,
  noTargetCardLeft
} from './coachmarkLayout'
import type { CoachStep } from './onboardingTours'
import { useCoachmarkFocusTrap } from './useCoachmarkFocusTrap'
import { useCoachmarkTarget } from './useCoachmarkTarget'

const PULSE_IDLE_MS = 4000

const {
  step,
  title,
  body,
  isLast,
  primaryLabel,
  skipLabel,
  countedStepIdx,
  countedStepsTotal,
  waitingForTarget
} = defineProps<{
  step: CoachStep
  title: string
  body: string
  isLast: boolean
  primaryLabel: string
  skipLabel: string
  countedStepIdx: number
  countedStepsTotal: number
  waitingForTarget: boolean
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

const { targetRect, targetEl, floatingStyles, isPositioned } =
  useCoachmarkTarget(() => step, cardRef)

const expectsTargetInteraction = computed(() => !!step.advanceOnTargetClick)
// Last step's "Done" already dismisses, so hide Skip unless the step has no primary button.
const showSkip = computed(() => !isLast || expectsTargetInteraction.value)

// The blocker only lets pointer events through to the target on interaction
// steps, so only then does the target join the focus cycle — keyboard and
// mouse users get the same reach.
const focusTrap = useCoachmarkFocusTrap({
  cardRef,
  getTarget: () => (expectsTargetInteraction.value ? targetEl.value : null),
  isSuspended: () => waitingForTarget,
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
  const el = overlayRef.value
  if (!el) return
  // ZIndex.set pushes a fresh entry into the shared modal sequence on every
  // call, so clear the previous one or per-step re-raises leak entries.
  ZIndex.clear(el)
  ZIndex.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
}

// A deferred dialog may have registered above the overlay; reclaim the stack
// top on every step.
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

function viewport() {
  return { width: windowWidth.value, height: windowHeight.value }
}

const spotlightStyle = computed(() => {
  const r = targetRect.value
  if (!r) return { opacity: '0' }
  return { ...clampSpotlight(r, SPOTLIGHT_PAD, viewport()), opacity: '1' }
})

// Interaction steps punch a hole in the blocker so only the target stays clickable.
const blockerStyle = computed(() => {
  const r = targetRect.value
  if (r && expectsTargetInteraction.value)
    return { clipPath: blockerClipPath(r) }
  return {}
})

const cardStyle = computed(() => {
  const width = `${CARD_WIDTH}px`
  const maxWidth = `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`
  if (!targetEl.value) {
    return {
      width,
      maxWidth,
      left: `${noTargetCardLeft(windowWidth.value)}px`,
      top: '30%'
    }
  }
  // Hidden until Floating UI positions it, avoiding a first-frame jump.
  return {
    ...floatingStyles.value,
    width,
    maxWidth,
    opacity: isPositioned.value ? '1' : '0'
  }
})
</script>
