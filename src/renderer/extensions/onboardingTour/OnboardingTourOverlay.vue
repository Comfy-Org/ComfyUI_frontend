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
              data-testid="onboarding-hole"
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
              'fill-base-background/95',
              !reduceMotion && 'transition-opacity duration-500 ease-out',
              revealed ? 'opacity-100' : 'opacity-0'
            )
          "
          mask="url(#onboarding-tour-spotlight)"
        />
      </svg>

      <div
        v-for="(hole, i) in visibleSpotRects"
        :key="i"
        data-testid="onboarding-spotlight"
        :class="
          cn(
            'absolute border-node-component-outline',
            !reduceMotion && 'transition-opacity duration-300 ease-out',
            revealed ? 'opacity-100' : 'opacity-0',
            isRunStep ? 'rounded-lg border' : 'rounded-xl border-2'
          )
        "
        :style="ringStyle(hole)"
      />

      <div
        ref="bubbleRef"
        data-testid="onboarding-coach-mark"
        :class="
          cn(
            'absolute flex h-fit w-full max-w-xs flex-col gap-6 rounded-2xl bg-secondary-background p-5 shadow-interface',
            !reduceMotion &&
              (markGlides
                ? 'transition-[top,left,opacity] ease-in-out'
                : 'transition-opacity duration-300 ease-out'),
            bubbleVisible
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
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
            v-if="!isResultStep"
            variant="textonly"
            size="md"
            class="font-normal"
            @click="controller.end('skip')"
          >
            {{ t('onboardingTour.skip') }}
          </Button>
          <div class="ml-auto flex items-center gap-2">
            <Button
              v-if="stepIndex > 0 && !isResultStep"
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
                isLastStep
                  ? t('onboardingTour.complete')
                  : t('onboardingTour.next')
              }}
              <i
                :class="
                  cn(
                    'size-4',
                    isLastStep
                      ? 'icon-[lucide--check]'
                      : 'icon-[lucide--arrow-right]'
                  )
                "
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
import {
  useElementBounding,
  usePreferredReducedMotion,
  useRafFn,
  useResizeObserver,
  useWindowSize
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'

import {
  ACTIONBAR_SELECTOR,
  COACH_MARK_GAP,
  INITIAL_SETTLE,
  RUN_BUTTON_SELECTOR,
  TOUR_FOCUS_DURATION_MS,
  canvasElement,
  canvasTransformKey,
  canvasViewport,
  coachMarkPosition,
  focusNodes,
  maskRectsFor,
  rectIntersectsViewport,
  trackSettle
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
  resultMedia,
  runFinished,
  tourRunId
} = storeToRefs(store)

const isActive = computed(() => phase.value === 'active')
const isLastStep = computed(() => stepIndex.value >= totalSteps.value - 1)

const isRunStep = computed(() => currentStep.value?.kind === 'run')
const isResultStep = computed(() => currentStep.value?.kind === 'result')

/** Gated on the run reporting, not on media: a timed-out capture must not spin forever. */
const isGenerating = computed(
  () => isResultStep.value && !runFinished.value && !resultMedia.value
)

/** The Run step advances on click, so it offers no Next. */
const showNextButton = computed(() => !isRunStep.value)

function stepCopyKey(step: TourStep): { title: string; body: string } {
  const base = 'onboardingTour.step'
  switch (step.kind) {
    case 'upload': {
      const shape = step.shape ?? 'other'
      return {
        title: `${base}.upload.${shape}.title`,
        body: `${base}.upload.${shape}.body`
      }
    }
    case 'prompt': {
      const shape = step.shape ?? 'other'
      return {
        title: `${base}.prompt.${shape}.title`,
        body: `${base}.prompt.${shape}.body`
      }
    }
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

function onNext() {
  if (isLastStep.value) {
    controller.end('done')
  } else {
    void controller.advance()
  }
}

// Called at setup, not inside the computed: a computed getter has no effect scope,
// so the matchMedia listener VueUse registers there would never be disposed.
const preferredMotion = usePreferredReducedMotion()
const reduceMotion = computed(() => preferredMotion.value === 'reduce')

/** Undimmed preview of the whole workflow before the tour dims to the first target. */
const INTRO_PREVIEW_MS = 500
/** The camera waits this out, so the mark's glide and the framing never run at once. */
const MARK_GLIDE_MS = 400
/** A camera that never settles (the user keeps panning) must not strand the copy. */
const SETTLE_WATCHDOG_MS = TOUR_FOCUS_DURATION_MS + 200

const revealed = ref(false)
const bubbleVisible = ref(false)
/** True once the tour has zoomed in; later steps pan at that scale. */
const hasZoomed = ref(false)
const cameraSettled = ref(false)
/**
 * The side the mark sits on, held for the step so it doesn't jump as the user pans.
 * Latched only once the framing settles, so the choice reflects the final view.
 */
const lockedEdge = ref<CoachMarkEdge | undefined>()

let introTimer: ReturnType<typeof setTimeout> | null = null
let cameraTimer: ReturnType<typeof setTimeout> | null = null
let watchdogTimer: ReturnType<typeof setTimeout> | null = null
let settle = INITIAL_SETTLE
let awaitingSettle = false

function clearTimers() {
  for (const timer of [introTimer, cameraTimer, watchdogTimer]) {
    if (timer !== null) clearTimeout(timer)
  }
  introTimer = cameraTimer = watchdogTimer = null
}

function showCopy() {
  awaitingSettle = false
  if (watchdogTimer !== null) clearTimeout(watchdogTimer)
  watchdogTimer = null
  cameraSettled.value = true
  bubbleVisible.value = true
}

/**
 * Whether the mark glides to its target or is pinned to it. It glides on a step
 * change; while the canvas moves it is pinned, so it rides the canvas as one object
 * rather than chasing it on a second easing curve.
 */
const markGlides = ref(false)
let lastTransformKey: string | null = null

function pinMarkWhileCanvasMoves() {
  const key = canvasTransformKey()
  if (key !== lastTransformKey) {
    lastTransformKey = key
    markGlides.value = false
  }
}

/** Holds the copy hidden until the camera stops, so text never slides mid-zoom. */
function pollSettle() {
  if (!awaitingSettle) return
  settle = trackSettle(settle, canvasTransformKey())
  if (settle.settled) showCopy()
}

/** Measured from the rendered mark, so the framing tracks the real card. */
function reserve() {
  return {
    width: bubbleWidth.value + COACH_MARK_GAP,
    height: bubbleHeight.value + COACH_MARK_GAP
  }
}

/**
 * Reveal a step: frame its target, then show the copy once the camera is still.
 *
 * @param glideFirst Delay the camera so the mark travels first and the two motions
 * read in sequence. False for the opening step, which has nowhere to travel from.
 */
function beginStep(glideFirst = true) {
  // The Run step points at the toolbar, so it never moves the camera.
  const moves = !isRunStep.value
  revealed.value = true

  if (!moves || reduceMotion.value) {
    if (!reduceMotion.value) markGlides.value = true
    return showCopy()
  }

  const frame = () => {
    // Reserving only on the first framing zooms once; later steps pan at that scale.
    focusNodes(
      [...spotlitNodeIds.value],
      hasZoomed.value ? undefined : reserve()
    )
    hasZoomed.value = true
  }

  markGlides.value = true
  awaitingSettle = true
  settle = INITIAL_SETTLE
  const delay = glideFirst ? MARK_GLIDE_MS : 0
  if (delay === 0) frame()
  else cameraTimer = setTimeout(frame, delay)
  watchdogTimer = setTimeout(showCopy, delay + SETTLE_WATCHDOG_MS)
}

watch(
  [isActive, stepIndex, tourRunId],
  ([active, , runId], previous) => {
    clearTimers()
    awaitingSettle = false
    bubbleVisible.value = false
    cameraSettled.value = false
    lockedEdge.value = undefined
    if (!active) {
      revealed.value = false
      hasZoomed.value = false
      return
    }
    // A fresh tour, not a step change. Keyed to the run id rather than an
    // idle→active edge: `start()` passes through idle within one tick, so the
    // watcher only ever sees active→active and would carry the last tour's zoom in.
    const justOpened = previous?.[2] !== runId
    if (!justOpened) return beginStep()

    revealed.value = false
    hasZoomed.value = false
    if (reduceMotion.value) return beginStep(false)
    introTimer = setTimeout(() => beginStep(false), INTRO_PREVIEW_MS)
  },
  { immediate: true }
)

const holeRects = ref<ScreenRect[]>([])
const spotRects = ref<ScreenRect[]>([])

/**
 * The canvas rect, not the window: the app insets the canvas below the top bar and
 * beside the panels, so placing against the window put the mark under that chrome.
 * Falls back to the window until the canvas exists.
 */
const { width: windowWidth, height: windowHeight } = useWindowSize()
const canvasRect = ref<ScreenRect | null>(null)
const viewport = computed<ScreenRect>(
  () =>
    canvasRect.value ?? {
      left: 0,
      top: 0,
      width: windowWidth.value,
      height: windowHeight.value
    }
)

/** Holes are cut only once the steps begin, so the intro preview reads undimmed. */
const visibleHoleRects = computed(() => (revealed.value ? holeRects.value : []))
const visibleSpotRects = computed(() =>
  revealed.value
    ? spotRects.value.filter((rect) =>
        rectIntersectsViewport(rect, viewport.value)
      )
    : []
)

const focusRect = computed(() => spotRects.value[0] ?? null)

const bubbleRef = useTemplateRef<HTMLElement>('bubbleRef')

/** Client rect of the first element matching `selector`, or null if absent. */
function domClientRect(selector: string): ScreenRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const { left, top, width, height } = el.getBoundingClientRect()
  return { left, top, width, height }
}

/** Result cuts the toolbar out of the scrim unringed, so the eye stays on the node. */
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
  const toolbarRect = isResultStep.value
    ? domClientRect(ACTIONBAR_SELECTOR)
    : null
  if (toolbarRect) revealed.push(toolbarRect)
  holeRects.value = revealed
  spotRects.value = spotlit
}

/** Keeps the rects aligned while the canvas moves, under the tour's camera or the user's. */
function onFrame() {
  canvasRect.value = canvasViewport()
  recompute()
  pinMarkWhileCanvasMoves()
  pollSettle()
}

const { pause, resume } = useRafFn(onFrame, { immediate: false })

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

// animateToBounds captures the canvas size when the tween starts, so a resize
// mid-flight lands the camera short. Re-frame against the new size.
useResizeObserver(
  computed(() => (isActive.value ? canvasElement() : null)),
  () => {
    if (!isActive.value || awaitingSettle || !revealed.value) return
    if (isRunStep.value || !hasZoomed.value) return
    focusNodes([...spotlitNodeIds.value])
  }
)

// Only on open, not on every step: re-focusing would yank focus back mid-interaction.
watch(isActive, (active) => {
  if (active) void bubbleRef.value?.focus()
})

// Routing away mid-tour must end the tour, so the controller's grace timer can't
// outlive the UI it drives.
onUnmounted(() => {
  clearTimers()
  if (isActive.value) controller.end('skip')
})

/** Px the node ring sits outside the box, mirroring litegraph's selection overlay. */
const NODE_RING_OFFSET = 3

/** The node ring frames the box from outside; the Run button ring hugs it tightly. */
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

/** Null while the target is off-screen, so the mark holds its last placement. */
const placement = computed(() => {
  const rect = focusRect.value
  if (!rect) return null
  if (!rectIntersectsViewport(rect, viewport.value)) return null
  return coachMarkPosition(
    rect,
    { width: bubbleWidth.value, height: bubbleHeight.value },
    viewport.value,
    lockedEdge.value
  )
})

// Once latched, the side only changes if the user pans far enough to break its fit.
watch([placement, cameraSettled], ([pos, settled]) => {
  if (settled && pos) lockedEdge.value = pos.pointerEdge
})

// Shares MARK_GLIDE_MS with the camera delay, so the mark lands before it starts.
const bubbleStyle = computed(() => {
  const glide = markGlides.value
    ? { transitionDuration: `${MARK_GLIDE_MS}ms` }
    : {}
  return placement.value
    ? {
        ...glide,
        position: 'fixed' as const,
        top: `${placement.value.top}px`,
        left: `${placement.value.left}px`
      }
    : {
        ...glide,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
})

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
