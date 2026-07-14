<!-- Bottom-right "explore templates" nudge shown once the tour ends. -->
<template>
  <div
    v-if="shouldShow"
    role="status"
    class="pointer-events-auto fixed right-4 bottom-4 z-1000 flex w-80 flex-col overflow-hidden rounded-lg border border-border-default bg-base-background shadow-interface"
  >
    <div class="relative h-50 w-full bg-secondary-background">
      <video
        v-if="media?.kind === 'video'"
        :src="media.url"
        data-testid="onboarding-nudge-video"
        class="size-full object-cover"
        autoplay
        muted
        loop
        playsinline
      />
      <img
        v-else
        :src="media?.url ?? FALLBACK_MEDIA"
        :alt="t('onboardingTour.nudge.title')"
        class="size-full object-cover"
      />
      <Button
        class="absolute top-2 right-2 size-8 opacity-50 hover:opacity-100"
        variant="secondary"
        size="icon"
        :aria-label="t('g.close')"
        @click="store.dismissNudge()"
      >
        <i class="icon-[lucide--x] size-4" aria-hidden="true" />
      </Button>
    </div>

    <div
      class="flex flex-col gap-2 border-t border-border-default px-4 pt-6 pb-4"
    >
      <p class="m-0 text-sm/5 font-bold text-base-foreground">
        {{ t('onboardingTour.nudge.title') }}
      </p>
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('onboardingTour.nudge.body') }}
      </p>
    </div>

    <div class="flex items-center justify-end gap-4 px-4 pb-4">
      <Button
        variant="link"
        size="unset"
        class="h-6 text-sm font-normal"
        @click="store.dismissNudge()"
      >
        {{ t('onboardingTour.nudge.dismiss') }}
      </Button>
      <Button
        variant="inverted"
        size="lg"
        class="font-normal"
        @click="onExplore"
      >
        {{ t('onboardingTour.nudge.explore') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { UPGRADE_DIALOG_KEYS } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

import { useOnboardingTourStore } from './onboardingTourStore'

const FALLBACK_MEDIA = '/assets/images/og-image.png'

const { t } = useI18n()
const store = useOnboardingTourStore()
const dialogStore = useDialogStore()

const { resultMedia: media } = storeToRefs(store)

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
