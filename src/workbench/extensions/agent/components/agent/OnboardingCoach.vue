<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { arrow, autoUpdate, offset, shift, useFloating } from '@floating-ui/vue'
import type { Middleware } from '@floating-ui/vue'
import {
  useElementBounding,
  useEventListener,
  useTimeoutFn,
  useWindowSize
} from '@vueuse/core'
import { FocusScope } from 'reka-ui'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import {
  SPOTLIGHT_PAD,
  clampSpotlight,
  unionRect
} from '@/platform/onboarding/coachmarkLayout'
import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useTelemetry } from '@comfyorg/telemetry'
import type { AgentOnboardingAction } from '@comfyorg/telemetry/types'
import type { CoachStep } from '@/workbench/extensions/agent/composables/agent/useOnboarding'
import {
  reportMissingCoachTarget,
  useOnboarding
} from '@/workbench/extensions/agent/composables/agent/useOnboarding'

/** Long enough for any panel layout to settle; a target still absent is a regression. */
const TARGET_MISSING_AFTER_MS = 8000
const COACH_HOVER_ATTRIBUTE = 'data-coach-hover'
/** How long a click outside the card keeps it highlighted. */
const NUDGE_MS = 1200
/** Keeps the arrow off the card's rounded corners. */
const ARROW_PADDING = 20

const { steps, storageKey, holdNotice } = defineProps<{
  steps: CoachStep[]
  storageKey?: string
  holdNotice?: string
}>()
const emit = defineEmits<{ finished: []; stalled: [] }>()

const { active, index, step, isLast, next, previous, finish, restart } =
  useOnboarding(() => steps, storageKey)

// Reported off `visible` below, latched so one tour reports once.
let reportedShown = false

// The replay control lives in the panel header, outside this component.
// `reportedShown` is latched per tour, so a replay has to clear it or the
// second showing never reaches trackAgentOnboardingShown().
defineExpose({
  restart: () => {
    reportedShown = false
    restart()
  }
})

const titleId = useId()
const bodyId = useId()
const holdNoticeId = useId()
const describedBy = computed(() =>
  holdNotice ? `${bodyId} ${holdNoticeId}` : bodyId
)
const advanceLabelKey = computed(() =>
  isLast.value ? 'onboardingCoachmarks.done' : 'g.next'
)
const target = ref<HTMLElement | null>(null)
const visible = computed(() => active.value && target.value !== null)
// Let surfaces like the What's New popup defer while a coach card is on
// screen. The store drops the source with this component's scope on unmount.
useOnboardingOverlayStore().registerSource(() => visible.value)
const toolbar = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const arrowElement = ref<HTMLElement | null>(null)
const primaryAction = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const bounds = useElementBounding(target)
const toolbarBounds = useElementBounding(toolbar)
const tooltipBounds = useElementBounding(tooltip)
const { width, height } = useWindowSize()
let targetRetryTimer: ReturnType<typeof setTimeout> | undefined

function scheduleTargetRetry(): void {
  clearTimeout(targetRetryTimer)
  if (!active.value || target.value) return
  targetRetryTimer = setTimeout(() => {
    resolveTargets()
    scheduleTargetRetry()
  }, 50)
}

function resolveTargets(): void {
  const nextTarget = active.value
    ? document.querySelector<HTMLElement>(step.value.target)
    : null
  const nextToolbar =
    active.value && step.value.toolbarTarget
      ? document.querySelector<HTMLElement>(step.value.toolbarTarget)
      : null
  if (target.value !== nextTarget) target.value = nextTarget
  if (toolbar.value !== nextToolbar) toolbar.value = nextToolbar
  bounds.update()
  toolbarBounds.update()
  scheduleTargetRetry()
}

// Reported off `visible`, the same condition the card renders and the overlay
// source registers on, so the tour is never counted as seen while it is still
// waiting for a target to mount.
watch(visible, (isVisible) => {
  if (!isVisible || reportedShown) return
  reportedShown = true
  useTelemetry()?.trackAgentOnboardingShown()
})

function reportStep(action: AgentOnboardingAction): void {
  useTelemetry()?.trackAgentOnboardingStep({ step: index.value + 1, action })
}

let finishedHere = false

function onNext(): void {
  const finished = isLast.value
  reportStep(isLast.value ? 'finish' : 'next')
  if (finished) finishedHere = true
  next()
  if (finished) emit('finished')
}

function onSkip(): void {
  reportStep('skip')
  finishedHere = true
  finish()
  emit('finished')
}

const completed = computed(() => !active.value && !!step.value)
watch(completed, (isCompleted) => {
  if (isCompleted && !finishedHere) emit('finished')
  finishedHere = false
})

const targetObserver = new MutationObserver(resolveTargets)
targetObserver.observe(document.body, {
  childList: true,
  subtree: true
})
let reportedStalled = false
const missingTarget = computed(() =>
  active.value && !target.value ? step.value.target : null
)
const { start: startMissingTargetTimer, stop: stopMissingTargetTimer } =
  useTimeoutFn(
    (selector: string, step: number) => {
      reportMissingCoachTarget(selector, step)
      if (reportedStalled) return
      reportedStalled = true
      emit('stalled')
    },
    TARGET_MISSING_AFTER_MS,
    { immediate: false }
  )
watch(
  missingTarget,
  (selector) => {
    stopMissingTargetTimer()
    if (selector) startMissingTargetTimer(selector, index.value + 1)
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  targetObserver.disconnect()
  clearTimeout(targetRetryTimer)
})

watch([target, () => step.value?.tooltip], ([element, text], _, onCleanup) => {
  if (!element || !text) return
  element.setAttribute(COACH_HOVER_ATTRIBUTE, '')
  onCleanup(() => element.removeAttribute(COACH_HOVER_ATTRIBUTE))
})

const tooltipStyle = computed(() => ({
  left: `${bounds.right.value}px`,
  top: `${bounds.top.value + bounds.height.value / 2}px`
}))

watch(
  [active, step],
  async () => {
    await nextTick()
    resolveTargets()
  },
  { immediate: true, flush: 'post' }
)

const middleware = computed<Middleware[]>(() => {
  const result = [
    offset({
      mainAxis: 16,
      crossAxis: step.value?.placement === 'left-start' ? -16 : 0
    })
  ]
  if (step.value?.placement === 'graph-bottom') {
    const bottom = toolbar.value ? toolbarBounds.top.value : bounds.bottom.value
    result.push({
      name: 'graphBottom',
      fn: ({ rects }) => ({
        x:
          rects.reference.x +
          (rects.reference.width - rects.floating.width) / 2,
        y:
          Math.min(bottom, rects.reference.y + rects.reference.height) -
          16 -
          rects.floating.height
      })
    })
  }
  return [...result, shift({ padding: 8, crossAxis: true })]
})

// Only side-placed cards sit next to their target; the canvas card sits on it.
const pointsAtTarget = computed(() => step.value?.placement.startsWith('left'))

const { floatingStyles, isPositioned, middlewareData } = useFloating(
  target,
  card,
  {
    strategy: 'fixed',
    transform: false,
    placement: () =>
      step.value?.placement === 'left-center'
        ? 'left'
        : step.value?.placement === 'left-end'
          ? 'left-end'
          : 'left-start',
    middleware: () => [
      ...middleware.value,
      arrow({ element: arrowElement, padding: ARROW_PADDING })
    ],
    whileElementsMounted: autoUpdate
  }
)

const arrowStyle = computed(() => {
  const y = middlewareData.value.arrow?.y
  return y === undefined ? { opacity: 0 } : { top: `${y}px` }
})

// The arrow shares the card's border so it reads as part of the card.
const cardBorderClass = computed(() =>
  index.value < 2 ? 'border-secondary' : 'border-smoke-500/20'
)

// The scrim swallows clicks so the tour stays modal. A user looking at the
// highlighted panel otherwise clicks it with no response, so point them at the
// card instead.
const nudged = ref(false)
const { start: startNudgeTimer } = useTimeoutFn(
  () => (nudged.value = false),
  NUDGE_MS,
  { immediate: false }
)
async function nudgeCard(): Promise<void> {
  nudged.value = false
  await nextTick()
  nudged.value = true
  startNudgeTimer()
  const action = primaryAction.value
  const element = action instanceof HTMLElement ? action : action?.$el
  element?.focus()
}

const spotlightStyle = computed(() => {
  const targetRect = new DOMRect(
    bounds.left.value,
    bounds.top.value,
    bounds.width.value,
    bounds.height.value
  )
  const hasTooltip = tooltipBounds.width.value > 0
  return clampSpotlight(
    hasTooltip
      ? unionRect(
          targetRect,
          new DOMRect(
            tooltipBounds.left.value,
            tooltipBounds.top.value,
            tooltipBounds.width.value,
            tooltipBounds.height.value
          )
        )
      : targetRect,
    hasTooltip ? SPOTLIGHT_PAD : 0,
    { width: width.value, height: height.value }
  )
})

useEventListener(
  document,
  'keydown',
  (event) => {
    if (!active.value || !target.value || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onSkip()
  },
  { capture: true }
)
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="agent-scope fixed inset-0 z-tour">
      <div
        class="absolute inset-0"
        data-testid="agent-coach-scrim"
        @click="nudgeCard"
      />
      <div
        aria-hidden="true"
        data-testid="agent-coach-spotlight"
        :style="{ ...spotlightStyle }"
        class="pointer-events-none absolute rounded-lg border-2 border-foreground shadow-[0_0_0_9999px_color-mix(in_srgb,var(--color-black)_60%,transparent)]"
      />
      <div
        v-if="step.tooltip"
        ref="tooltip"
        role="tooltip"
        :style="tooltipStyle"
        class="pointer-events-none absolute flex max-w-50 -translate-y-1/2 items-center"
      >
        <span
          aria-hidden="true"
          class="size-0 border-y-4 border-r-4 border-y-transparent border-r-border"
        />
        <div
          class="rounded-md border bg-background px-3 py-2 text-xs/tight wrap-break-word whitespace-pre-line text-foreground shadow-md"
        >
          {{ step.tooltip }}
        </div>
      </div>
      <FocusScope as-child trapped loop>
        <div
          ref="card"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="describedBy"
          tabindex="-1"
          :data-nudged="nudged ? '' : undefined"
          :style="{
            ...floatingStyles,
            opacity: isPositioned ? 1 : 0
          }"
          :class="
            cn(
              'fixed box-border flex max-h-[calc(100vh-16px)] w-[307px] max-w-[calc(100vw-16px)] flex-col gap-3 rounded-2xl border bg-background p-4 text-foreground shadow-lg transition-shadow',
              cardBorderClass,
              nudged &&
                'ring-2 ring-foreground ring-offset-2 ring-offset-background'
            )
          "
        >
          <span
            v-if="pointsAtTarget"
            ref="arrowElement"
            aria-hidden="true"
            data-testid="agent-coach-arrow"
            :style="arrowStyle"
            :class="
              cn(
                'pointer-events-none absolute -right-1.5 size-3 rotate-45 border-t border-r bg-background',
                cardBorderClass
              )
            "
          />
          <div class="flex min-h-0 flex-col gap-6 overflow-y-auto">
            <div class="flex flex-col gap-2">
              <p class="m-0 text-xs/normal opacity-50">
                {{
                  $t('agent.coachProgress', {
                    current: index + 1,
                    total: steps.length
                  })
                }}
              </p>
              <h3
                :id="titleId"
                class="m-0 text-base/normal font-semibold text-pretty"
              >
                {{ step.title }}
              </h3>
              <p
                :id="bodyId"
                class="m-0 text-sm/normal text-pretty text-muted-foreground"
              >
                {{ step.body }}
              </p>
              <p
                v-if="holdNotice"
                :id="holdNoticeId"
                class="m-0 text-xs/normal text-muted-foreground"
                data-testid="agent-coach-hold-notice"
              >
                {{ holdNotice }}
              </p>
            </div>
            <div class="flex justify-end gap-3">
              <Button
                v-if="index > 0"
                variant="textonly"
                size="md"
                class="mr-auto"
                @click="previous"
                >{{ $t('onboardingCoachmarks.back') }}</Button
              >
              <Button variant="secondary" size="md" @click="onSkip">{{
                $t('agent.skip')
              }}</Button>
              <Button
                ref="primaryAction"
                variant="inverted"
                size="md"
                @click="onNext"
                >{{ $t(advanceLabelKey) }}</Button
              >
            </div>
          </div>
        </div>
      </FocusScope>
    </div>
  </Teleport>
</template>
