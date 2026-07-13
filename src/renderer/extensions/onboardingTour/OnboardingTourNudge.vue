<!--
  Post-run "explore templates" nudge (Figma 1706:37844). Surfaces bottom-right
  after the tour's first successful run, and as the fallback once the no-funds
  upgrade modal closes (armed by the run-step gate). Reuses NotificationPopup.
-->
<template>
  <NotificationPopup
    v-if="shouldShow"
    icon="icon-[lucide--sparkles]"
    :title="t('onboardingTour.nudge.title')"
    position="bottom-right"
  >
    <p class="pl-14">{{ t('onboardingTour.nudge.body') }}</p>

    <template #footer-end>
      <Button
        variant="link"
        size="unset"
        class="h-6 px-0 text-sm font-normal"
        @click="store.dismissNudge()"
      >
        {{ t('onboardingTour.nudge.dismiss') }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        class="font-normal"
        @click="onExplore"
      >
        {{ t('onboardingTour.nudge.explore') }}
      </Button>
    </template>
  </NotificationPopup>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NotificationPopup from '@/components/common/NotificationPopup.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

import { useOnboardingTourStore } from './onboardingTourStore'

const UPGRADE_DIALOG_KEYS = ['free-tier-info', 'subscription-required'] as const

const { t } = useI18n()
const store = useOnboardingTourStore()
const dialogStore = useDialogStore()

const shouldShow = computed(() => store.shouldShowNudge)

// No-funds fallback: the run-step gate opens the upgrade modal and arms the
// nudge; surface it only once that modal has closed so the two never overlap.
const upgradeModalOpen = computed(() =>
  UPGRADE_DIALOG_KEYS.some((key) => dialogStore.isDialogOpen(key))
)

watch(upgradeModalOpen, (open, wasOpen) => {
  if (wasOpen && !open && store.nudgeArmed) store.showNudge()
})

watch(shouldShow, (visible) => {
  if (visible) useTelemetry()?.trackOnboardingTourNudgeShown?.()
})

function onExplore() {
  useWorkflowTemplateSelectorDialog().show('command')
  useTelemetry()?.trackOnboardingTourExploreTemplatesClicked?.()
  store.dismissNudge()
}
</script>
