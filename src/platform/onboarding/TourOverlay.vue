<template>
  <CoachmarkLanding
    v-if="step?.landing"
    v-model:open="landingOpen"
    :title="t(step.titleKey)"
    :message="t(step.bodyKey)"
    :image="step.image"
    :primary-label="primaryLabel"
    :skip-label="skipLabel"
    @start="onPrimary"
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
      class="pointer-events-none absolute rounded-[10px] shadow-[0_0_0_9999px_rgba(0,0,0,0.62)] transition-all duration-300"
      :style="spotlightStyle"
    />
    <svg
      v-if="targetRect"
      aria-hidden="true"
      class="pointer-events-none absolute overflow-visible transition-all duration-300"
      :style="spotlightStyle"
    >
      <rect
        data-testid="coach-spotlight-ring"
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx="10"
        fill="none"
        stroke="white"
        stroke-width="2"
        :class="
          outlinePulsing &&
          'motion-safe:animate-[coach-pulse_1.2s_ease-in-out_infinite]'
        "
      />
    </svg>
    <div
      ref="cardRef"
      role="dialog"
      aria-modal="true"
      :aria-label="t(step.titleKey)"
      :aria-describedby="bodyId"
      class="pointer-events-auto absolute transition-[left,top] duration-300"
      :style="cardStyle"
    >
      <CoachmarkCard
        :subtitle="
          t('onboardingCoachmarks.stepLabel', {
            current: countedStepIdx + 1,
            total: countedSteps.length
          })
        "
        :title="t(step.titleKey)"
        :message="t(step.bodyKey)"
        :message-id="bodyId"
        :image="step.image"
        :elevated="step.elevated"
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
            @click="onPrimary"
          >
            {{ primaryLabel }}
          </Button>
        </template>
      </CoachmarkCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import CoachmarkCard from './CoachmarkCard.vue'
import CoachmarkLanding from './CoachmarkLanding.vue'
import { SPOTLIGHT_PAD } from './onboardingTours'
import { useCoachmarkTour } from './useCoachmarkTour'

// Keeps the spotlight's 2px outline clear of the viewport edge.
const SPOTLIGHT_EDGE_INSET = 2
const CARD_WIDTH = 300
// Standard gap between the card and its target / the viewport edge.
const CARD_GAP = 16
const VIEWPORT_MARGIN = 12
// Keeps the card clear of the top bar.
const TOP_SAFE_INSET = 56
const CARD_TOP_NUDGE = 8

const { t } = useI18n()
const bodyId = useId()

const overlayRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const { height: cardHeight } = useElementSize(cardRef, undefined, {
  box: 'border-box'
})

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
  onPrimary,
  end
} = useCoachmarkTour({ cardRef, overlayRef })

// The landing renders as a real modal Dialog; dismissing it (escape, close
// button, Skip) ends the tour. Advancing to a spotlight step flips `step.landing`
// to false, closing the Dialog without re-triggering this skip.
const landingOpen = computed({
  get: () => !!step.value?.landing,
  set: (value) => {
    if (!value) end('skipped')
  }
})

// Keep the padded spotlight box — and its outline — inside the viewport
// when the target hugs an edge.
function clampToViewport(r: DOMRect, pad: number) {
  const left = Math.max(SPOTLIGHT_EDGE_INSET, r.left - pad)
  const top = Math.max(SPOTLIGHT_EDGE_INSET, r.top - pad)
  const right = Math.min(
    window.innerWidth - SPOTLIGHT_EDGE_INSET,
    r.right + pad
  )
  const bottom = Math.min(
    window.innerHeight - SPOTLIGHT_EDGE_INSET,
    r.bottom + pad
  )
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, right - left)}px`,
    height: `${Math.max(0, bottom - top)}px`
  }
}

const spotlightStyle = computed(() => {
  const r = targetRect.value
  if (!r) return { opacity: '0' }
  return { ...clampToViewport(r, SPOTLIGHT_PAD), opacity: '1' }
})

/**
 * Eats pointer events everywhere (the spotlight's shadow does the dimming).
 * Steps the user advances by interacting with the target (clicking it, or
 * closing it) get a hole at the target's exact bounds — not the padded
 * spotlight — so neighbouring elements can't be clicked by accident.
 *
 * The hole is a single polygon tracing the viewport then the target rect; the
 * `evenodd` fill-rule subtracts the inner loop. fill-rule is a valid argument
 * to the CSS `polygon()` basic shape (Baseline since 2020), not SVG-only — the
 * click-through is covered by tour.spec.ts ("a click just outside must not
 * advance" plus the target click that opens the dialog).
 */
const blockerStyle = computed(() => {
  const r = targetRect.value
  // No target (Nodes 2.0 gate): no spotlight shadow, so dim here.
  if (!r) return { background: 'rgba(0,0,0,0.62)' }
  if (!expectsTargetInteraction.value) return {}
  const x1 = `${r.left}px`
  const y1 = `${r.top}px`
  const x2 = `${r.right}px`
  const y2 = `${r.bottom}px`
  return {
    clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1} ${y1}, ${x1} ${y2}, ${x2} ${y2}, ${x2} ${y1}, ${x1} ${y1})`
  }
})

type ResolvedPlacement =
  | 'left'
  | 'right'
  | 'center'
  | 'bottom'
  | 'topRight'
  | 'leftCenter'

function cardCorner(placement: ResolvedPlacement, r: DOMRect) {
  switch (placement) {
    case 'left':
      return {
        x: r.left - CARD_WIDTH - CARD_GAP,
        y: Math.max(TOP_SAFE_INSET, r.top + CARD_TOP_NUDGE)
      }
    case 'leftCenter':
      return {
        x: r.left - CARD_WIDTH - CARD_GAP,
        y: r.top + r.height / 2 - cardHeight.value / 2
      }
    case 'right':
      return { x: r.right + CARD_GAP, y: r.top + CARD_TOP_NUDGE }
    case 'bottom':
      return {
        x: r.left + r.width / 2 - CARD_WIDTH / 2,
        y: r.bottom + CARD_GAP
      }
    case 'center':
      return {
        x: r.left + r.width / 2 - CARD_WIDTH / 2,
        y: r.top + r.height / 2 - cardHeight.value / 2
      }
    // Tucks into the target's top-right corner, over the close button so the
    // user can only advance by interacting with the target's contents.
    case 'topRight':
      return { x: r.right - CARD_WIDTH - CARD_GAP, y: r.top + CARD_GAP }
  }
  // A new placement without a case above fails to compile here.
  return placement satisfies never
}

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
      left: `${Math.max(VIEWPORT_MARGIN, (window.innerWidth - CARD_WIDTH) / 2)}px`,
      top: '30%'
    }
  }
  const placement: ResolvedPlacement =
    s.placement === 'auto'
      ? window.innerWidth - r.right >= r.left
        ? 'right'
        : 'left'
      : s.placement
  const { x, y } = cardCorner(placement, r)
  return {
    width,
    maxWidth,
    left: `${Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - CARD_WIDTH - CARD_GAP))}px`,
    top: `${Math.max(TOP_SAFE_INSET, Math.min(y, window.innerHeight - cardHeight.value - CARD_GAP))}px`,
    // Vertically-centred placements need the measured height; hide the first
    // frame (height still 0) so the card appears already in its final spot.
    opacity: cardHeight.value > 0 ? '1' : '0'
  }
})
</script>

<style>
@keyframes coach-pulse {
  50% {
    opacity: 0.4;
  }
}
</style>
