<!--
  Progressive-disclosure overlay (true-hide, option (a): SVG-mask only).
  A near-opaque scrim covers the canvas; holes are cut only for the current
  step's revealed nodes, so everything else reads as absent without any graph
  mutation. Step copy binds from the active step; Skip/Back/Next drive the tour
  controller.
-->
<template>
  <Teleport v-if="isActive" to="body">
    <div
      class="pointer-events-none fixed inset-0 z-3000"
      role="dialog"
      :aria-label="t('onboardingTour.overlayLabel')"
    >
      <svg class="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <mask id="onboarding-tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            <rect
              v-for="(hole, i) in holeRects"
              :key="i"
              :x="hole.left"
              :y="hole.top"
              :width="hole.width"
              :height="hole.height"
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          class="fill-base-background/95"
          mask="url(#onboarding-tour-spotlight)"
        />
      </svg>

      <div
        v-for="(hole, i) in spotRects"
        :key="i"
        data-testid="onboarding-spotlight"
        class="absolute rounded-lg border border-border-default transition-all duration-500 ease-out"
        :style="ringStyle(hole)"
      />

      <div
        ref="bubbleRef"
        class="pointer-events-auto absolute flex w-80 flex-col gap-6 rounded-2xl bg-secondary-background p-5 shadow-interface transition-all duration-500 ease-out"
        :style="bubbleStyle"
        tabindex="-1"
        aria-live="polite"
      >
        <i
          v-if="placement"
          data-testid="onboarding-cursor"
          :class="
            cn(
              'absolute icon-[lucide--lasso-select] size-4 text-base-foreground drop-shadow-md',
              cursorEdgeClass
            )
          "
          aria-hidden="true"
        />
        <div class="flex flex-col gap-2">
          <span class="text-xs text-base-foreground opacity-50">
            {{
              t('onboardingTour.stepCounter', {
                current: stepIndex + 1,
                total: totalSteps
              })
            }}
          </span>
          <h2 class="text-base font-semibold text-base-foreground">
            {{ t(copy.title) }}
          </h2>
          <p class="text-sm text-muted-foreground">{{ t(copy.body) }}</p>
          <p v-if="showPortHint" class="text-sm text-muted-foreground">
            {{ t('onboardingTour.step.prompt.portHint') }}
          </p>
        </div>

        <div class="flex items-center justify-between">
          <button
            type="button"
            class="text-xs text-base-foreground transition-opacity hover:opacity-70"
            @click="controller.end('skip')"
          >
            {{ t('onboardingTour.skip') }}
          </button>
          <div class="flex items-center gap-2">
            <button
              v-if="stepIndex > 0"
              type="button"
              class="flex items-center gap-1 rounded-lg border border-muted-background bg-secondary-background px-3 py-2 text-xs text-base-foreground transition-colors hover:bg-secondary-background-hover"
              @click="controller.back()"
            >
              <i class="icon-[lucide--arrow-left] size-4" aria-hidden="true" />
              {{ t('onboardingTour.back') }}
            </button>
            <button
              v-if="showNextButton"
              type="button"
              class="flex items-center gap-1 rounded-lg bg-base-foreground px-3 py-2 text-xs text-base-background transition-opacity hover:opacity-90"
              @click="onNext"
            >
              {{
                isLastStep ? t('onboardingTour.done') : t('onboardingTour.next')
              }}
              <i
                v-if="!isLastStep"
                class="icon-[lucide--arrow-right] size-4"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useElementBounding, useRafFn, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  RUN_BUTTON_SELECTOR,
  coachMarkPosition,
  focusNodes,
  maskRectsFor
} from './canvasSpotlightAdapter'
import type { CoachMarkEdge, ScreenRect } from './canvasSpotlightAdapter'
import { useOnboardingTourController } from './useOnboardingTourController'
import { useOnboardingTourStore } from './onboardingTourStore'
import type { TourStep } from './tourSequence'

const { t } = useI18n()

const store = useOnboardingTourStore()
const controller = useOnboardingTourController()
const {
  phase,
  stepIndex,
  revealedNodeIds,
  spotlitNodeIds,
  currentStep,
  totalSteps,
  promptPortFallback,
  resultMedia
} = storeToRefs(store)

const isActive = computed(() => phase.value === 'active')
const isLastStep = computed(() => stepIndex.value >= totalSteps.value - 1)

const isRunStep = computed(() => currentStep.value?.kind === 'run')
const isResultStep = computed(() => currentStep.value?.kind === 'result')

// The Run step advances on click (no Next escape); every later step keeps Next.
const showNextButton = computed(() => !isRunStep.value)

const showPortHint = computed(
  () => currentStep.value?.kind === 'prompt' && promptPortFallback.value
)

function stepCopyKey(step: TourStep): { title: string; body: string } {
  const base = 'onboardingTour.step'
  switch (step.kind) {
    case 'upload':
      return { title: `${base}.upload.title`, body: `${base}.upload.body` }
    case 'prompt':
      return { title: `${base}.prompt.title`, body: `${base}.prompt.body` }
    case 'run':
      return { title: `${base}.run.title`, body: `${base}.run.body` }
    case 'result': {
      const media = step.mediaKind ?? 'image'
      // Bridge the generating gap: pending until the media lands, then ready.
      const state = resultMedia.value ? 'ready' : 'pending'
      return {
        title: `${base}.result.${media}.${state}.title`,
        body: `${base}.result.${media}.${state}.body`
      }
    }
  }
}

const copy = computed(() =>
  currentStep.value ? stepCopyKey(currentStep.value) : { title: '', body: '' }
)

function onNext() {
  if (isLastStep.value) {
    controller.end('done')
  } else {
    void controller.advance()
  }
}

// The run progress UI varies by queue-panel flag; match whichever is mounted.
const RUN_PROGRESS_SELECTOR =
  '[data-testid="queue-progress-overlay"], [data-testid="queue-inline-progress"]'

const holeRects = ref<ScreenRect[]>([])
const spotRects = ref<ScreenRect[]>([])

const focusRect = computed(() => spotRects.value[0] ?? null)

const bubbleRef = useTemplateRef<HTMLElement>('bubbleRef')

/** Client rect of the first element matching `selector`, or null if absent. */
function domClientRect(selector: string): ScreenRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const { left, top, width, height } = el.getBoundingClientRect()
  return { left, top, width, height }
}

// Run step spotlights the toolbar button; Result also spotlights the run progress
// bar (while it's on screen) so progress shows where it happens.
function recompute() {
  if (isRunStep.value) {
    const rect = domClientRect(RUN_BUTTON_SELECTOR)
    const rects = rect ? [rect] : []
    holeRects.value = rects
    spotRects.value = rects
    return
  }

  const revealed = maskRectsFor([...revealedNodeIds.value])
  const spotlit = maskRectsFor([...spotlitNodeIds.value])
  const progressRect = isResultStep.value
    ? domClientRect(RUN_PROGRESS_SELECTOR)
    : null
  if (progressRect) {
    revealed.push(progressRect)
    spotlit.push(progressRect)
  }
  holeRects.value = revealed
  spotRects.value = spotlit
}

// RAF keeps the rects aligned while the user pans/zooms the canvas.
const { pause, resume } = useRafFn(recompute, { immediate: false })

function focusCurrentStep() {
  if (!isRunStep.value) focusNodes([...spotlitNodeIds.value])
}

watch(
  [isActive, revealedNodeIds, spotlitNodeIds, currentStep],
  ([active]) => {
    if (active) {
      recompute()
      focusCurrentStep()
      resume()
    } else {
      pause()
      holeRects.value = []
      spotRects.value = []
    }
  },
  { immediate: true }
)

// Move focus to the coach-mark only when the tour opens — not on every step
// reveal, which would yank focus back mid-interaction.
watch(isActive, (active) => {
  if (active) void bubbleRef.value?.focus()
})

// Tearing down the overlay (e.g. route away mid-tour) must end the tour so the
// controller's grace timer can't outlive the UI it drives.
onUnmounted(() => {
  if (isActive.value) controller.end('skip')
})

function ringStyle(rect: ScreenRect) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  }
}

const { width: bubbleWidth, height: bubbleHeight } =
  useElementBounding(bubbleRef)
const { width: windowWidth, height: windowHeight } = useWindowSize()

// The coach-mark sits beside the target and never covers it; the cursor rides on
// the box edge nearest the target, so the card reads as pointing at the node.
const placement = computed(() => {
  const rect = focusRect.value
  if (!rect) return null
  return coachMarkPosition(
    rect,
    { width: bubbleWidth.value, height: bubbleHeight.value },
    { width: windowWidth.value, height: windowHeight.value }
  )
})

const bubbleStyle = computed(() =>
  placement.value
    ? {
        position: 'fixed' as const,
        top: `${placement.value.top}px`,
        left: `${placement.value.left}px`
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
)

// Pin the cursor to the box edge facing the target (centered on that edge).
const CURSOR_EDGE_CLASS: Record<CoachMarkEdge, string> = {
  top: '-top-3 left-1/2 -translate-x-1/2',
  bottom: '-bottom-3 left-1/2 -translate-x-1/2',
  left: '-left-3 top-1/2 -translate-y-1/2',
  right: '-right-3 top-1/2 -translate-y-1/2'
}
const cursorEdgeClass = computed(() =>
  placement.value ? CURSOR_EDGE_CLASS[placement.value.pointerEdge] : ''
)
</script>
