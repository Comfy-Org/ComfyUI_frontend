<!--
  Progressive-disclosure overlay (true-hide, option (a): SVG-mask only).
  A near-opaque scrim covers the canvas; holes are cut only for the current
  step's revealed nodes, so everything else reads as absent without any graph
  mutation. Presentation only — Skip emits; step content arrives via slots.
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

        <slot name="content" />

        <div class="flex items-center justify-between">
          <button
            type="button"
            class="text-xs text-muted-foreground transition-colors hover:text-base-foreground"
            @click="emit('skip')"
          >
            {{ t('onboardingTour.skip') }}
          </button>
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { maskRectsFor } from './canvasSpotlightAdapter'
import type { ScreenRect } from './canvasSpotlightAdapter'
import { useOnboardingTourStore } from './onboardingTourStore'

const { totalSteps = 1 } = defineProps<{ totalSteps?: number }>()

const emit = defineEmits<{ skip: [] }>()

const { t } = useI18n()

const store = useOnboardingTourStore()
const { phase, stepIndex, revealedNodeIds } = storeToRefs(store)

const isActive = computed(() => phase.value === 'active')

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
