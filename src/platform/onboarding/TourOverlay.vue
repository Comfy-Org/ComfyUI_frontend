<template>
  <CoachmarkLanding
    v-if="step?.landing"
    v-model:open="landingOpen"
    :title="t(step.titleKey)"
    :message="t(step.bodyKey)"
    :image="step.image"
    :primary-label="primaryLabel"
    :skip-label="skipLabel"
    @start="next"
  />
  <div
    v-else-if="step"
    ref="overlayRef"
    class="pointer-events-none fixed inset-0"
  >
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
      :aria-label="t(step.titleKey)"
      :aria-describedby="`${subtitleId} ${bodyId}`"
      class="pointer-events-auto absolute max-h-[calc(100vh-72px)] overflow-y-auto motion-safe:transition-[left,top] motion-safe:duration-300"
      :style="cardStyle"
    >
      <CoachmarkCard
        :subtitle="
          t('onboardingCoachmarks.stepLabel', {
            current: countedStepIdx + 1,
            total: countedSteps.length
          })
        "
        :subtitle-id="subtitleId"
        :title="t(step.titleKey)"
        :message="t(step.bodyKey)"
        :message-id="bodyId"
        :image="step.image"
      >
        <template #actions>
          <Button
            v-if="showSkip"
            variant="secondary"
            size="md"
            @click="end('skipped')"
          >
            {{ skipLabel }}
          </Button>
          <Button
            v-if="!expectsTargetInteraction"
            variant="inverted"
            size="md"
            @click="next"
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
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import CoachmarkCard from './CoachmarkCard.vue'
import CoachmarkLanding from './CoachmarkLanding.vue'
import {
  CARD_WIDTH,
  SCRIM_COLOR,
  SPOTLIGHT_PAD,
  VIEWPORT_MARGIN,
  blockerClipPath,
  cardCorner,
  clampCardPosition,
  clampSpotlight,
  noTargetCardLeft,
  resolvePlacement
} from './coachmarkLayout'
import { useCoachmarkTour } from './useCoachmarkTour'

const { t } = useI18n()
const bodyId = useId()
const subtitleId = useId()

const overlayRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const { height: cardHeight } = useElementSize(cardRef, undefined, {
  box: 'border-box'
})
const { width: windowWidth, height: windowHeight } = useWindowSize()

const {
  step,
  countedSteps,
  countedStepIdx,
  targetRect,
  primaryLabel,
  skipLabel,
  expectsTargetInteraction,
  outlinePulsing,
  showSkip,
  next,
  end
} = useCoachmarkTour({ cardRef, overlayRef })

// Dismissing the landing Dialog (escape/close/Skip) ends the tour; advancing flips
// `step.landing` false to close it without skipping.
const landingOpen = computed({
  get: () => !!step.value?.landing,
  set: (value) => {
    if (!value) end('skipped')
  }
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
  const r = targetRect.value
  const s = step.value
  if (!s) return {}
  // Cap the width on viewports narrower than the card so it never overflows.
  const width = `${CARD_WIDTH}px`
  const maxWidth = `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`
  if (!r) {
    return {
      width,
      maxWidth,
      left: `${noTargetCardLeft(windowWidth.value)}px`,
      top: '30%'
    }
  }
  const placement = resolvePlacement(s.placement, r, windowWidth.value)
  const corner = cardCorner(placement, r, cardHeight.value)
  return {
    width,
    maxWidth,
    ...clampCardPosition(corner, cardHeight.value, viewport()),
    // Centred placements need the measured height; hide frame 0 (height still 0) to avoid a jump.
    opacity: cardHeight.value > 0 ? '1' : '0'
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
