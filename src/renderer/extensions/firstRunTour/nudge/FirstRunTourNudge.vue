<template>
  <!--
    Right-inset, not right-0: a docked surface takes layout width this fixed
    box cannot see, so `right-0` parks the nudge on top of the Agent panel's
    starter prompts and composer (PM-1872). Unlike a dialog, the nudge is a
    fixed 320px, so it steps aside instead of being resized.

    Clamped, because stepping aside and staying on screen stop being the same
    thing. The panel keeps layout width down to a ~476px window (it only goes
    overlay below `requestedWidth + reservedWorkspaceWidth`, and the reserve
    is the 56px rail alone once no sidebar is open), and it widens to 960px
    maximized — either way the inset can exceed `viewport - 320`. Past that
    point the nudge covers the panel rather than leaving the viewport, which
    is the same call `dialogContentVariants` makes. `20rem` is `w-80` below
    and has to stay in step with it; `100%` cannot stand in for the width
    here, because a percentage `right` resolves against the containing block,
    not the box.
  -->
  <div
    v-if="onScreen"
    role="region"
    :aria-labelledby="titleId"
    data-testid="first-run-nudge"
    class="fixed right-[max(0px,min(var(--workspace-inset-right,0px),calc(100vw-20rem)))] bottom-0 z-1000 flex w-80 animate-in flex-col overflow-hidden rounded-tl-xl border-t border-l border-border-default/50 bg-base-background shadow-lg duration-500 fade-in-0"
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
</template>

<script setup lang="ts">
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

const NUDGE_IMAGE = '/assets/images/og-image.png'

/** Delayed, so the finished workflow is seen before this fades in over it. */
const APPEAR_DELAY_MS = 1500

const { t } = useI18n()
const { nudgeArmed, tourWasCompleted, dismissNudge } =
  useFirstRunTourController()
const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const titleId = useId()

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
  () => nudgeArmed.value && dialogStore.dialogStack.length === 0,
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
