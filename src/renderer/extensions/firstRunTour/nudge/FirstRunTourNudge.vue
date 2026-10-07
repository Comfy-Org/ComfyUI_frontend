<template>
  <template v-if="onScreen">
    <div
      v-if="isPositioned && ringStyle"
      aria-hidden="true"
      data-testid="first-run-nudge-ring"
      class="pointer-events-none fixed z-1000 rounded-xl outline-2 outline-coach-ring"
      :style="{ ...ringStyle }"
    />
    <div
      ref="cardRef"
      role="region"
      :aria-labelledby="titleId"
      data-testid="first-run-nudge"
      :class="
        cn(
          'fixed z-1000 w-80 animate-in duration-500 fade-in-0',
          !isPositioned && 'invisible'
        )
      "
      :style="floatingStyles"
    >
      <i
        data-testid="first-run-nudge-cursor"
        :class="
          cn(
            'absolute icon-[lucide--mouse-pointer-2] size-4 text-base-foreground drop-shadow-md',
            cursorEdgeClass(placement)
          )
        "
        aria-hidden="true"
      />
      <div
        class="flex flex-col overflow-hidden rounded-xl border border-border-default/50 bg-base-background shadow-lg"
      >
        <div class="relative h-50 w-full bg-secondary-background">
          <img :src="NUDGE_IMAGE" alt="" class="size-full object-cover" />
          <Button
            class="absolute top-2 right-2 opacity-50 hover:opacity-100"
            variant="secondary"
            size="icon"
            :aria-label="t('g.close')"
            @click="dismissNudge"
          >
            <i class="icon-[lucide--x] size-4" aria-hidden="true" />
          </Button>
        </div>

        <div
          class="flex flex-col gap-2 border-t border-border-default px-4 pt-6 pb-4"
        >
          <p :id="titleId" class="m-0 text-sm/5 font-bold text-base-foreground">
            {{ t(`${copyKey}.title`) }}
          </p>
          <p class="m-0 text-sm text-muted-foreground">
            {{ t(`${copyKey}.body`) }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-4 px-4 pb-4">
          <Button
            variant="link"
            size="unset"
            class="h-6 text-sm font-normal"
            @click="dismissNudge"
          >
            {{ t('onboardingCoachmarks.firstRun.nudge.dismiss') }}
          </Button>
          <Button
            variant="inverted"
            size="lg"
            class="font-normal"
            data-testid="first-run-nudge-explore"
            @click="onExplore"
          >
            {{ t('onboardingCoachmarks.firstRun.nudge.explore') }}
          </Button>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  breakpointsTailwind,
  useBreakpoints,
  useEventListener,
  useTimeoutFn,
  useWindowSize
} from '@vueuse/core'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import {
  SPOTLIGHT_PAD,
  clampSpotlight,
  cursorEdgeClass
} from '@/platform/onboarding/coachmarkLayout'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'
import type { SpotlightStep } from '@/platform/onboarding/onboardingTours'
import { useCoachmarkTarget } from '@/platform/onboarding/useCoachmarkTarget'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

const NUDGE_IMAGE = '/assets/images/og-image.png'

/** Delayed, so the finished workflow is seen before this fades in over it. */
const APPEAR_DELAY_MS = 1500

const { t } = useI18n()
const { nudgeArmed, tourWasCompleted, dismissNudge } =
  useFirstRunTourController()
const dialogStore = useDialogStore()
const settingStore = useSettingStore()
const sidebarTabStore = useSidebarTabStore()
const agentNodeSelectionStore = useAgentNodeSelectionStore()
const onboardingTourStore = useOnboardingTourStore()
const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
const telemetry = useTelemetry()
const titleId = useId()

const nudgeStep = computed<SpotlightStep>(() => ({
  kind: 'spotlight',
  name: 'nudge',
  coachId: nudgeArmed.value ? FIRST_RUN_COACH_IDS.templatesButton : undefined,
  placement:
    settingStore.get('Comfy.Sidebar.Location') === 'right'
      ? 'leftCenter'
      : 'rightCenter',
  cursor: true
}))

const cardRef = ref<HTMLElement | null>(null)
const {
  anchor,
  hasTarget,
  targetRect,
  floatingStyles,
  isPositioned,
  placement
} = useCoachmarkTarget(nudgeStep, cardRef)
const { width: windowWidth, height: windowHeight } = useWindowSize()

const ringStyle = computed(
  () =>
    targetRect.value &&
    clampSpotlight(targetRect.value, SPOTLIGHT_PAD, {
      width: windowWidth.value,
      height: windowHeight.value
    })
)

// Only a tour walked to the end made a first result to congratulate; every
// other ending still gets a nudge, pointing at the templates instead.
const copyKey = computed(
  () =>
    `onboardingCoachmarks.firstRun.nudge.${tourWasCompleted.value ? 'ran' : 'noTour'}`
)

const onScreen = ref(false)
let reported = false
const { start: scheduleAppearance, stop: cancelAppearance } = useTimeoutFn(
  () => {
    if (anchor.value instanceof HTMLElement)
      anchor.value.scrollIntoView({ block: 'nearest' })
    onScreen.value = true
    if (reported) return
    reported = true
    telemetry?.trackOnboardingTour('nudge_shown', {
      tour: 'firstRun',
      tour_completed: tourWasCompleted.value
    })
  },
  APPEAR_DELAY_MS,
  { immediate: false }
)

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (onScreen.value && event.key === 'Escape') dismissNudge()
})

/** The nudge sits below the modal stack, so it waits for a clear screen. */
watch(
  () =>
    desktopLayout.value &&
    dialogStore.dialogStack.length === 0 &&
    hasTarget.value &&
    !onboardingTourStore.activeTour &&
    !agentNodeSelectionStore.isActionBarsHidden &&
    !sidebarTabStore.activeSidebarTab,
  (screenIsClear) => {
    cancelAppearance()
    if (!screenIsClear) {
      onScreen.value = false
      return
    }
    scheduleAppearance()
  },
  { immediate: true }
)

function onExplore() {
  useWorkflowTemplateSelectorDialog().show('first_run_nudge')
  telemetry?.trackOnboardingTour('explore_templates_clicked', {
    tour: 'firstRun',
    tour_completed: tourWasCompleted.value
  })
  dismissNudge()
}
</script>
