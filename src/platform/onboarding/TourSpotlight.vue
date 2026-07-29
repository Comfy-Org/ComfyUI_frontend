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
          v-if="scrimHole"
          data-testid="coach-mask-hole"
          v-bind="scrimHole"
          rx="12"
          fill="black"
          :class="
            !targetMoves &&
            'motion-safe:transition-[x,y,width,height] motion-safe:duration-300'
          "
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
          !targetMoves &&
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
        data-testid="coach-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="`${subtitleId} ${bodyId}`"
        :class="
          cn(
            'absolute motion-safe:duration-300',
            glides
              ? 'motion-safe:transition-[left,top,opacity]'
              : 'motion-safe:transition-opacity',
            cardVisible ? 'pointer-events-auto' : 'pointer-events-none'
          )
        "
        :style="cardStyle"
      >
        <i
          v-if="cursorEdgeClass"
          data-testid="coach-cursor"
          :class="
            cn(
              'absolute icon-[lucide--mouse-pointer-2] size-4 text-base-foreground drop-shadow-md',
              cursorEdgeClass
            )
          "
          aria-hidden="true"
        />
        <i
          v-if="step.busy?.()"
          data-testid="coach-busy"
          class="absolute top-4 right-4 z-10 icon-[lucide--loader-circle] size-3.5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <CoachmarkCard
          class="max-h-[calc(100vh-var(--comfy-topbar-height)-2rem)] overflow-y-auto"
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
                v-if="!step.selfAdvancing"
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
import { useEventListener, useWindowSize } from '@vueuse/core'
import { ZIndex } from '@primeuix/utils/zindex'
import { FocusScope } from 'reka-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  useTemplateRef,
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
  CARD_GLIDE_MS,
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

const {
  targetRect,
  targetEl,
  targetMoves,
  floatingStyles,
  isPositioned,
  placement
} = useCoachmarkTarget(() => step, cardRef)

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

const maskId = useId()

const useMaskScrim = computed(() => !!step.interactive)

const scrimHole = computed(() =>
  targetRect.value
    ? clampSpotlightRect(targetRect.value, SPOTLIGHT_PAD, viewport())
    : null
)

const spotlightStyle = computed(() => {
  const hole = scrimHole.value
  if (!hole?.width || !hole.height) return { opacity: '0' }
  return {
    left: `${hole.x}px`,
    top: `${hole.y}px`,
    width: `${hole.width}px`,
    height: `${hole.height}px`,
    opacity: '1'
  }
})

// Evenodd viewport path whose hole lets pointer events through to the page.
const hitRegionPath = computed(() => {
  const { width, height } = viewport()
  const hole = scrimHole.value
  const viewportPath = `M0 0H${width}V${height}H0Z`
  if (!hole) return viewportPath
  return `${viewportPath}M${hole.x} ${hole.y}h${hole.width}v${hole.height}h${-hole.width}Z`
})

/**
 * The card travels to a new target, then rides it — a transition lags a target
 * that moves every frame. Only a change arms travel; the first card makes none.
 */
const glides = ref(false)
watch([() => step, targetMoves], ([, moves], _previous, onCleanup) => {
  glides.value = true
  if (!moves) return
  const timer = setTimeout(() => (glides.value = false), CARD_GLIDE_MS)
  onCleanup(() => clearTimeout(timer))
})

/** Hidden until Floating UI has placed it, so it fades in already sited. */
const cardVisible = computed(() => !targetEl.value || isPositioned.value)

const cardStyle = computed(() => {
  const width = `${CARD_WIDTH}px`
  const maxWidth = `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`
  const opacity = cardVisible.value ? '1' : '0'
  if (!targetEl.value) {
    return {
      width,
      maxWidth,
      left: `${noTargetCardLeft(windowWidth.value)}px`,
      top: '30%',
      opacity
    }
  }
  return { ...floatingStyles.value, width, maxWidth, opacity }
})

/** Floats the cursor in the gap on the card edge facing the target. */
const CURSOR_EDGE_CLASS = {
  top: '-top-7 left-1/2 -translate-x-1/2 rotate-45',
  bottom: '-bottom-7 left-1/2 -translate-x-1/2 -rotate-[135deg]',
  left: '-left-7 top-1/2 -translate-y-1/2 -rotate-45',
  right: '-right-7 top-1/2 -translate-y-1/2 rotate-[135deg]'
} as const

const TARGET_FACING_EDGE = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
} as const

const cursorEdgeClass = computed(() => {
  if (!step.cursor || !targetEl.value) return ''
  const side = placement.value.split('-')[0] as keyof typeof TARGET_FACING_EDGE
  return CURSOR_EDGE_CLASS[TARGET_FACING_EDGE[side]]
})
</script>
