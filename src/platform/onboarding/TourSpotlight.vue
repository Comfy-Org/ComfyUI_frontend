<template>
  <div ref="overlayRef" class="pointer-events-none fixed inset-0">
    <svg
      v-if="useMaskScrim"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 size-full"
    >
      <mask :id="maskId">
        <rect width="100%" height="100%" fill="white" />
        <rect
          v-if="scrimHoles.primary"
          data-testid="coach-mask-hole"
          v-bind="scrimHoles.primary"
          rx="12"
          fill="black"
          :class="
            !isVirtualTarget &&
            'motion-safe:transition-[x,y,width,height] motion-safe:duration-300'
          "
        />
        <rect
          v-for="(hole, i) in scrimHoles.extras"
          :key="i"
          data-testid="coach-mask-hole"
          v-bind="hole"
          rx="12"
          fill="black"
        />
      </mask>
      <rect
        width="100%"
        height="100%"
        class="fill-coach-scrim"
        :mask="`url(#${maskId})`"
      />
      <path
        v-if="step.interactive"
        data-testid="coach-hit-region"
        :d="hitRegionPath"
        fill="transparent"
        fill-rule="evenodd"
        class="pointer-events-auto"
      />
    </svg>
    <div
      v-if="!step.interactive"
      data-testid="coach-blocker"
      :class="
        cn(
          'pointer-events-auto absolute inset-0',
          !useMaskScrim && !targetRect && 'bg-coach-scrim'
        )
      "
    />
    <div
      aria-hidden="true"
      data-testid="coach-spotlight"
      :class="
        cn(
          'pointer-events-none absolute rounded-xl outline-2 outline-coach-ring',
          !isVirtualTarget &&
            'motion-safe:transition-[left,top,width,height,opacity] motion-safe:duration-300',
          !useMaskScrim && 'shadow-[0_0_0_9999px_var(--color-coach-scrim)]'
        )
      "
      :style="spotlightStyle"
    />
    <FocusScope
      as-child
      :trapped="!waitingForTarget && !step.interactive"
      loop
      @mount-auto-focus.prevent
    >
      <div
        ref="cardRef"
        role="dialog"
        aria-modal="true"
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
              variant="textonly"
              size="md"
              @click="emit('skip')"
            >
              {{ skipLabel }}
            </Button>
            <div class="ml-auto flex items-center gap-3">
              <Button
                v-if="canGoBack"
                variant="secondary"
                size="md"
                class="border border-solid border-border-default"
                @click="emit('back')"
              >
                <i class="icon-[lucide--arrow-left]" />
                {{ backLabel }}
              </Button>
              <Button
                ref="primaryButton"
                variant="inverted"
                size="md"
                :disabled="waitingForTarget"
                @click="emit('advance')"
              >
                {{ primaryLabel }}
                <i v-if="!isLast" class="icon-[lucide--arrow-right]" />
              </Button>
            </div>
          </template>
        </CoachmarkCard>
      </div>
    </FocusScope>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener, useRafFn, useWindowSize } from '@vueuse/core'
import { ZIndex } from '@primeuix/utils/zindex'
import { FocusScope } from 'reka-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import { MODAL_Z_BASE, MODAL_Z_KEY } from '@/components/dialog/vRekaZIndex'
import Button from '@/components/ui/button/Button.vue'

import CoachmarkCard from './CoachmarkCard.vue'
import {
  CARD_WIDTH,
  SPOTLIGHT_PAD,
  VIEWPORT_MARGIN,
  clampSpotlight,
  clampSpotlightRect,
  noTargetCardLeft
} from './coachmarkLayout'
import type { CoachStep } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'

const {
  step,
  title,
  body,
  isLast,
  canGoBack,
  primaryLabel,
  skipLabel,
  backLabel,
  countedStepIdx,
  countedStepsTotal,
  waitingForTarget
} = defineProps<{
  step: CoachStep
  title: string
  body: string
  isLast: boolean
  canGoBack: boolean
  primaryLabel: string
  skipLabel: string
  backLabel: string
  countedStepIdx: number
  countedStepsTotal: number
  waitingForTarget: boolean
}>()

const emit = defineEmits<{
  advance: []
  back: []
  skip: []
}>()

const { t } = useI18n()
const bodyId = useId()
const subtitleId = useId()
const titleId = useId()

const overlayRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const { width: windowWidth, height: windowHeight } = useWindowSize()

const { targetRect, targetEl, isVirtualTarget, floatingStyles, isPositioned } =
  useCoachmarkTarget(() => step, cardRef)

// Last step's "Done" already dismisses, so hide Skip there.
const showSkip = computed(() => !isLast)

const primaryButton =
  useTemplateRef<InstanceType<typeof Button>>('primaryButton')

async function focusPrimary() {
  await nextTick()
  const el = primaryButton.value?.$el as HTMLElement | undefined
  el?.focus()
}

useEventListener(
  document,
  'keydown',
  (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    emit('skip')
  },
  { capture: true }
)

async function raiseOverlay() {
  await nextTick()
  const el = overlayRef.value
  if (!el) return
  // ZIndex.set pushes a fresh entry into the shared modal sequence on every
  // call, so clear the previous one or per-step re-raises leak entries.
  ZIndex.clear(el)
  ZIndex.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
}

watch(
  () => step,
  () => void raiseOverlay(),
  { immediate: true }
)

watch(
  [() => step, () => waitingForTarget],
  () => {
    if (!waitingForTarget) void focusPrimary()
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

const maskId = useId()

const useMaskScrim = computed(() => !!(step.interactive || step.maskRects))
const maskTick = ref(0)
const { pause: pauseMaskTracking, resume: resumeMaskTracking } = useRafFn(
  () => maskTick.value++,
  { immediate: false }
)
watchEffect(() => (step.maskRects ? resumeMaskTracking() : pauseMaskTracking()))

const scrimHoles = computed(() => {
  void maskTick.value
  const vp = viewport()
  return {
    primary: targetRect.value
      ? clampSpotlightRect(targetRect.value, SPOTLIGHT_PAD, vp)
      : null,
    extras: (step.maskRects?.() ?? []).map((r) =>
      clampSpotlightRect(r, SPOTLIGHT_PAD, vp)
    )
  }
})

// Evenodd viewport path whose holes let pointer events through to the page.
const hitRegionPath = computed(() => {
  const { width, height } = viewport()
  const { primary, extras } = scrimHoles.value
  const holes = primary ? [primary, ...extras] : extras
  return [
    `M0 0H${width}V${height}H0Z`,
    ...holes.map((h) => `M${h.x} ${h.y}h${h.width}v${h.height}h${-h.width}Z`)
  ].join('')
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
