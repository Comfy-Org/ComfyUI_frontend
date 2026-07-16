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
            copyVisible
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
              <i
                v-if="isLastStep"
                class="icon-[lucide--check] size-4"
                aria-hidden="true"
              />
              {{
                isLastStep
                  ? t('onboardingTour.complete')
                  : t('onboardingTour.next')
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
import {
  useElementBounding,
  usePreferredReducedMotion,
  useResizeObserver
} from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'

import {
  COACH_MARK_GAP,
  canvasElement,
  coachMarkPosition,
  focusNodes,
  rectIntersectsViewport
} from './canvasSpotlightAdapter'
import type { CoachMarkEdge, ScreenRect } from './canvasSpotlightAdapter'
import { MARK_GLIDE_MS, useTourChoreography } from './useTourChoreography'
import { useOnboardingTourController } from './useOnboardingTourController'
import { useOnboardingTourStore } from './onboardingTourStore'
import { useTourSpotlightRects } from './useTourSpotlightRects'
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
  const base = `onboardingTour.step.${step.kind}`
  switch (step.kind) {
    case 'upload':
    case 'prompt': {
      const shape = step.shape ?? 'other'
      return { title: `${base}.${shape}.title`, body: `${base}.${shape}.body` }
    }
    case 'run':
      return { title: `${base}.title`, body: `${base}.body` }
    case 'result': {
      const media = step.mediaKind ?? 'image'
      return { title: `${base}.${media}.title`, body: `${base}.${media}.body` }
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

const bubbleRef = useTemplateRef<HTMLElement>('bubbleRef')
const { width: bubbleWidth, height: bubbleHeight } =
  useElementBounding(bubbleRef)

/** True once the tour has zoomed in; later steps pan at that scale. */
const hasZoomed = ref(false)

/**
 * The side the mark sits on, held for the step so it doesn't jump as the user pans.
 * Latched only once the framing settles, so the choice reflects the final view.
 */
const lockedEdge = ref<CoachMarkEdge | undefined>()

/**
 * Frame the current step, reserving the mark's real footprint on the first framing
 * so the node is sized to leave room for it. Later steps pan at that scale.
 */
function frameTarget() {
  const reserve = {
    width: bubbleWidth.value + COACH_MARK_GAP,
    height: bubbleHeight.value + COACH_MARK_GAP
  }
  focusNodes([...spotlitNodeIds.value], hasZoomed.value ? undefined : reserve)
  hasZoomed.value = true
}

const choreography = useTourChoreography({
  reduceMotion,
  frameTarget,
  isStatic: isRunStep
})
const { revealed, copyVisible, cameraSettled, markGlides } = choreography

const rects = useTourSpotlightRects({
  isRunStep,
  isResultStep,
  revealedNodeIds,
  spotlitNodeIds,
  onFrame: choreography.sampleFrame
})
const { viewport, focusRect } = rects

/** Holes are cut only once the steps begin, so the intro preview reads undimmed. */
const visibleHoleRects = computed(() =>
  revealed.value ? rects.holeRects.value : []
)
const visibleSpotRects = computed(() =>
  revealed.value ? rects.visibleSpotRects.value : []
)

watch(
  [isActive, stepIndex, tourRunId],
  ([active, , runId], previous) => {
    if (!active) {
      choreography.endTour()
      hasZoomed.value = false
      return
    }
    // A fresh tour, not a step change. Keyed to the run id rather than an
    // idle→active edge: `start()` passes through idle within one tick, so the
    // watcher only ever sees active→active and would carry the last tour's zoom in.
    if (previous?.[2] === runId) {
      choreography.resetStep()
      lockedEdge.value = undefined
      choreography.beginStep()
      return
    }
    hasZoomed.value = false
    lockedEdge.value = undefined
    choreography.openTour()
  },
  { immediate: true }
)

watch(
  [isActive, revealedNodeIds, spotlitNodeIds, currentStep],
  ([active]) => (active ? rects.start() : rects.stop()),
  { immediate: true }
)

// animateToBounds captures the canvas size when the tween starts, so a resize
// mid-flight lands the camera short. Re-frame against the new size.
useResizeObserver(
  computed(() => (isActive.value ? canvasElement() : null)),
  () => {
    if (!isActive.value || choreography.isAwaitingSettle()) return
    if (!revealed.value || isRunStep.value || !hasZoomed.value) return
    focusNodes([...spotlitNodeIds.value])
  }
)

// Routing away mid-tour must end the tour, so the controller's grace timer can't
// outlive the UI it drives.
onUnmounted(() => {
  choreography.clearTimers()
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
