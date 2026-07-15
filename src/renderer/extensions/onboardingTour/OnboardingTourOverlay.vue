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
              v-for="(hole, i) in visibleHoleRects"
              :key="i"
              :x="hole.left"
              :y="hole.top"
              :width="hole.width"
              :height="hole.height"
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          :class="
            cn(
              'fill-base-background/95 transition-opacity duration-500 ease-out',
              revealed ? 'opacity-100' : 'opacity-0'
            )
          "
          mask="url(#onboarding-tour-spotlight)"
        />
      </svg>

      <div
        v-for="(hole, i) in spotRects"
        :key="i"
        data-testid="onboarding-spotlight"
        :class="
          cn(
            'absolute border border-node-component-outline/30 transition-opacity duration-300 ease-out',
            revealed ? 'opacity-100' : 'opacity-0',
            isRunStep ? 'rounded-lg' : 'rounded-xl'
          )
        "
        :style="ringStyle(hole)"
      />

      <div
        ref="bubbleRef"
        :class="
          cn(
            'absolute flex h-fit w-full max-w-xs flex-col gap-6 rounded-2xl bg-secondary-background p-5 shadow-interface',
            bubbleVisible
              ? 'pointer-events-auto opacity-100 transition-[top,left,opacity] duration-500 ease-out'
              : 'pointer-events-none opacity-0 transition-opacity duration-200 ease-out'
          )
        "
        :style="bubbleStyle"
        tabindex="-1"
        aria-live="polite"
      >
        <i
          v-if="placement"
          data-testid="onboarding-cursor"
          :class="
            cn(
              'absolute icon-[lucide--mouse-pointer-2] size-4 text-base-foreground drop-shadow-md',
              cursorEdgeClass
            )
          "
          aria-hidden="true"
        />
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-base-foreground opacity-50">
              {{
                t('onboardingTour.stepCounter', {
                  current: stepIndex + 1,
                  total: totalSteps
                })
              }}
            </span>
            <span
              v-if="isGenerating"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <DotSpinner :size="12" />
              {{ t('onboardingTour.generating') }}
            </span>
          </div>
          <h2 class="m-0 text-base font-semibold text-base-foreground">
            {{ t(copy.title) }}
          </h2>
          <p class="m-0 text-sm text-muted-foreground">{{ t(copy.body) }}</p>
        </div>

        <div class="flex items-center justify-between">
          <Button
            variant="textonly"
            size="md"
            class="font-normal"
            @click="controller.end('skip')"
          >
            {{ t('onboardingTour.skip') }}
          </Button>
          <div class="flex items-center gap-2">
            <Button
              v-if="stepIndex > 0"
              variant="secondary"
              size="md"
              class="gap-1 border border-muted-background px-3 py-2 font-normal"
              @click="controller.back()"
            >
              <i class="icon-[lucide--arrow-left] size-4" aria-hidden="true" />
              {{ t('onboardingTour.back') }}
            </Button>
            <Button
              v-if="showNextButton"
              variant="inverted"
              size="md"
              class="gap-1 px-3 py-2 font-normal"
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
            </Button>
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

import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'

import {
  RUN_BUTTON_SELECTOR,
  TOUR_FOCUS_DURATION_MS,
  TOUR_ZOOM_FILL,
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
  resultMedia
} = storeToRefs(store)

const isActive = computed(() => phase.value === 'active')
const isLastStep = computed(() => stepIndex.value >= totalSteps.value - 1)

const isRunStep = computed(() => currentStep.value?.kind === 'run')
const isResultStep = computed(() => currentStep.value?.kind === 'result')
const isGenerating = computed(() => isResultStep.value && !resultMedia.value)

// The Run step advances on click (no Next escape); every later step keeps Next.
const showNextButton = computed(() => !isRunStep.value)

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
      return {
        title: `${base}.result.${media}.title`,
        body: `${base}.result.${media}.body`
      }
    }
  }
}

const copy = computed(() =>
  currentStep.value ? stepCopyKey(currentStep.value) : { title: '', body: '' }
)

// When the tour opens, hold on the whole workflow undimmed for a beat so the
// user gets the lay of the land, THEN start the guided steps. Per step, let the
// camera finish framing the target before the highlight lights up (so it lands
// on an element already in position, not mid-zoom), then a beat later show the
// coach-mark copy. The Run step has no camera move, so its highlight is instant.
const INTRO_PREVIEW_MS = 1000
const CAMERA_SETTLE_MS = TOUR_FOCUS_DURATION_MS + 60
const MESSAGE_AFTER_SETTLE_MS = 140
const revealed = ref(false)
const bubbleVisible = ref(false)
// True once the tour has zoomed in on its first target; later steps only pan.
let framedOnce = false
let introTimer: ReturnType<typeof setTimeout> | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null
let messageTimer: ReturnType<typeof setTimeout> | null = null

function clearStepTimers() {
  for (const timer of [introTimer, highlightTimer, messageTimer]) {
    if (timer !== null) clearTimeout(timer)
  }
  introTimer = highlightTimer = messageTimer = null
}

// Reveal the spotlight and frame the target. The highlight stays lit through the
// whole tour and simply glides to each new target as the camera moves (rects
// track the node every frame, in sync with the eased camera), so the scrim never
// blacks out or pulses between steps. The copy is held back until the camera
// settles so the text doesn't slide across the screen mid-move.
function beginStepReveal() {
  // The first step stays at the workflow's default framing — no camera move, no
  // zoom; the highlight just lands where the first target already sits. A later
  // step that hasn't zoomed yet zooms in (its highlight appears only once the
  // camera settles, at final size); pan steps keep the highlight lit and glide
  // it over.
  const isFirstStep = stepIndex.value === 0
  const zoomsIn = !isFirstStep && !framedOnce && !isRunStep.value
  if (!isFirstStep) focusCurrentStep()
  const settle = isFirstStep || isRunStep.value ? 0 : CAMERA_SETTLE_MS
  if (zoomsIn) {
    highlightTimer = setTimeout(() => {
      revealed.value = true
    }, settle)
  } else {
    revealed.value = true
  }
  messageTimer = setTimeout(() => {
    bubbleVisible.value = true
  }, settle + MESSAGE_AFTER_SETTLE_MS)
}

watch(
  [isActive, stepIndex],
  ([active], oldValues) => {
    clearStepTimers()
    bubbleVisible.value = false
    if (!active) {
      revealed.value = false
      framedOnce = false
      return
    }
    // Fresh open (idle→active): hold on the undimmed full-flow preview, then
    // reveal and begin the guided steps. Between steps the spotlight stays lit
    // and glides to the next target.
    if (oldValues?.[0] !== true) {
      revealed.value = false
      framedOnce = false
      introTimer = setTimeout(beginStepReveal, INTRO_PREVIEW_MS)
      return
    }
    beginStepReveal()
  },
  { immediate: true }
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

// The hole is cut only while the guided steps are showing (not during the
// intro preview); it tracks the target node every frame as the camera moves.
const visibleHoleRects = computed(() => (revealed.value ? holeRects.value : []))

// Keep the last valid focus rect: during a transition the RAF can momentarily
// resolve no rects (the new target isn't ready for a frame), and letting this
// fall to null would snap the coach-mark to screen center and back — the flicker
// where the tooltip appears, vanishes, then reappears. Retaining the last rect
// holds it in place until the new target resolves.
const focusRect = ref<ScreenRect | null>(null)
watch(
  () => spotRects.value[0] ?? null,
  (rect) => {
    if (rect) focusRect.value = rect
  }
)

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

// Zoom in only on the first framed step; every later step pans at that same
// scale (zoom 0), so the view never zooms back out and in again between steps.
function focusCurrentStep() {
  if (isRunStep.value) return
  focusNodes([...spotlitNodeIds.value], framedOnce ? 0 : TOUR_ZOOM_FILL)
  framedOnce = true
}

watch(
  [isActive, revealedNodeIds, spotlitNodeIds, currentStep],
  ([active]) => {
    if (active) {
      recompute()
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
  clearStepTimers()
  if (isActive.value) controller.end('skip')
})

/** Px the node ring sits outside the box, mirroring litegraph's selection overlay (inset -3px). */
const NODE_RING_OFFSET = 3

// The node ring frames the box from just outside; the Run button ring hugs it tightly.
function ringStyle(rect: ScreenRect) {
  const offset = isRunStep.value ? 0 : NODE_RING_OFFSET
  return {
    left: `${rect.left - offset}px`,
    top: `${rect.top - offset}px`,
    width: `${rect.width + offset * 2}px`,
    height: `${rect.height + offset * 2}px`
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

/** Floats the cursor mid-gap on the target-facing edge, tip rotated toward the node. */
const CURSOR_EDGE_CLASS: Record<CoachMarkEdge, string> = {
  top: '-top-7 left-1/2 -translate-x-1/2 rotate-45',
  bottom: '-bottom-7 left-1/2 -translate-x-1/2 -rotate-[135deg]',
  left: '-left-7 top-1/2 -translate-y-1/2 -rotate-45',
  right: '-right-7 top-1/2 -translate-y-1/2 rotate-[135deg]'
}
const cursorEdgeClass = computed(() =>
  placement.value ? CURSOR_EDGE_CLASS[placement.value.pointerEdge] : ''
)
</script>
