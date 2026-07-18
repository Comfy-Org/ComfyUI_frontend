<template>
  <div
    v-if="shown"
    role="status"
    class="pointer-events-auto fixed right-0 bottom-0 z-1000 flex w-80 animate-in flex-col overflow-hidden rounded-tl-xl border-t border-l border-border-default/50 bg-base-background shadow-lg duration-500 fade-in-0"
  >
    <div class="relative h-50 w-full bg-secondary-background">
      <img
        v-if="!mediaReady"
        :src="FALLBACK_MEDIA"
        :alt="t('onboardingTour.nudge.title')"
        class="absolute inset-0 size-full object-cover"
      />
      <video
        v-if="!mediaFailed && media?.kind === 'video'"
        :key="media.url"
        :src="media.url"
        data-testid="onboarding-nudge-video"
        class="size-full object-cover"
        autoplay
        muted
        loop
        playsinline
        @loadeddata="onMediaLoaded"
        @error="onMediaFailed"
      />
      <img
        v-else-if="!mediaFailed && media"
        :key="media.url"
        :src="media.url"
        :alt="t('onboardingTour.nudge.title')"
        data-testid="onboarding-nudge-image"
        class="size-full object-cover"
        @load="onMediaLoaded"
        @error="onMediaFailed"
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
import { useTimeoutFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'

import { trackFirstRunTour } from './firstRunTourTelemetry'
import { isUpgradeModalOpen, useFirstRunTourStore } from './firstRunTourStore'

const FALLBACK_MEDIA = '/assets/images/og-image.png'

/** Delayed, so the fresh result is seen before the nudge fades in over it. */
const { appearDelayMs = 1500 } = defineProps<{ appearDelayMs?: number }>()

const { t } = useI18n()
const store = useFirstRunTourStore()

const { resultMedia: media } = storeToRefs(store)

/** Holds the default image until the result has actually decoded. */
const mediaReady = ref(false)
const mediaFailed = ref(false)
watch(media, () => {
  mediaReady.value = false
  mediaFailed.value = false
})

function onMediaLoaded() {
  mediaReady.value = true
}

function onMediaFailed() {
  mediaReady.value = false
  mediaFailed.value = true
}

const shouldShow = computed(() => store.shouldShowNudge)

const shown = ref(false)
const { start: startAppearDelay, stop: cancelAppearDelay } = useTimeoutFn(
  () => {
    shown.value = true
    trackFirstRunTour('nudge_shown')
  },
  () => appearDelayMs,
  { immediate: false }
)

watch(shouldShow, (visible) => {
  cancelAppearDelay()
  shown.value = false
  if (visible) startAppearDelay()
})

// The run-step gate arms the nudge behind the upgrade modal; surface it only once
// that modal closes, so the two never overlap.
const upgradeModalOpen = computed(() => isUpgradeModalOpen())

watch(upgradeModalOpen, (open, wasOpen) => {
  if (wasOpen && !open && store.nudgeArmed) store.showNudge()
})

function onExplore() {
  useWorkflowTemplateSelectorDialog().show('command')
  trackFirstRunTour('explore_templates_clicked')
  store.dismissNudge()
}
</script>
