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
              v-for="(hole, i) in litRects"
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
        v-for="(hole, i) in litRects"
        :key="i"
        data-testid="onboarding-spotlight"
        class="absolute rounded-lg border border-border-default transition-all duration-500 ease-out"
        :style="ringStyle(hole)"
      />

      <div
        ref="bubbleRef"
        class="pointer-events-auto absolute flex w-72 flex-col gap-2 rounded-lg border border-border-default bg-base-background p-4 shadow-interface transition-all duration-500 ease-out"
        :style="bubbleStyle"
        tabindex="-1"
        aria-live="polite"
      >
        <span class="text-xs text-muted-foreground">
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
        <p class="text-xs text-muted-foreground">{{ t(copy.body) }}</p>
        <p v-if="showPortHint" class="text-xs text-muted-foreground">
          {{ t('onboardingTour.step.prompt.portHint') }}
        </p>

        <img
          v-if="resultImageSrc"
          :src="resultImageSrc"
          :alt="t(copy.body)"
          class="max-w-full rounded-md"
        />
        <video
          v-else-if="resultVideoSrc"
          data-testid="onboarding-result-video"
          :src="resultVideoSrc"
          controls
          class="max-w-full rounded-md"
        />

        <div class="flex items-center justify-between">
          <button
            type="button"
            class="text-xs text-muted-foreground transition-colors hover:text-base-foreground"
            @click="controller.end('skip')"
          >
            {{ t('onboardingTour.skip') }}
          </button>
          <div class="flex items-center gap-2">
            <button
              v-if="stepIndex > 0"
              type="button"
              class="rounded-md px-3 py-1 text-xs text-base-foreground transition-colors hover:bg-node-component-surface"
              @click="controller.back()"
            >
              {{ t('onboardingTour.back') }}
            </button>
            <button
              type="button"
              class="rounded-md bg-primary-background px-3 py-1 text-xs text-base-foreground transition-colors hover:bg-primary-background-hover"
              @click="onNext"
            >
              {{
                isLastStep ? t('onboardingTour.done') : t('onboardingTour.next')
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener, useRafFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/scripts/api'

import { maskRectsFor } from './canvasSpotlightAdapter'
import type { ScreenRect } from './canvasSpotlightAdapter'
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
  currentStep,
  totalSteps,
  promptPortFallback,
  resultMedia
} = storeToRefs(store)

const isActive = computed(() => phase.value === 'active')
const isLastStep = computed(() => stepIndex.value >= totalSteps.value - 1)

const showPortHint = computed(
  () => currentStep.value?.kind === 'prompt' && promptPortFallback.value
)

const onResultStep = computed(() => currentStep.value?.kind === 'result')
const resultImageSrc = computed(() =>
  onResultStep.value && resultMedia.value?.kind === 'image'
    ? resultMedia.value.url
    : null
)
const resultVideoSrc = computed(() =>
  onResultStep.value && resultMedia.value?.kind === 'video'
    ? resultMedia.value.url
    : null
)

// The saved output arrives after the user's run completes; capture it so the
// Result step can render the real image/video.
useEventListener(api, 'execution_success', () => store.captureResultMedia())

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

function onNext() {
  if (isLastStep.value) {
    controller.end('done')
  } else {
    void controller.advance()
  }
}

const litRects = ref<ScreenRect[]>([])

const focusRect = computed(() => litRects.value[0] ?? null)

const bubbleRef = useTemplateRef<HTMLElement>('bubbleRef')

function recompute() {
  litRects.value = maskRectsFor([...revealedNodeIds.value])
}

// RAF keeps the rects aligned while the user pans/zooms the canvas.
const { pause, resume } = useRafFn(recompute, { immediate: false })

watch(
  [isActive, revealedNodeIds],
  ([active]) => {
    if (active) {
      recompute()
      resume()
    } else {
      pause()
      litRects.value = []
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

const bubbleStyle = computed(() => {
  const rect = focusRect.value
  if (!rect) {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }
  return { left: `${rect.left}px`, top: `${rect.top + rect.height + 12}px` }
})
</script>
