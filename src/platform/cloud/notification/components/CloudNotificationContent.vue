<template>
  <div
    data-testid="cloud-notification-dialog"
    class="relative grid h-full grid-cols-5"
  >
    <Button
      size="unset"
      variant="muted-textonly"
      class="absolute top-2.5 right-2.5 z-10 size-8 rounded-full p-0 text-white hover:bg-white/20"
      :aria-label="t('g.close')"
      @click="onDismiss"
    >
      <i class="pi pi-times" />
    </Button>

    <div
      class="relative col-span-2 flex items-center justify-center overflow-hidden rounded-sm"
    >
      <video
        autoplay
        loop
        muted
        playsinline
        class="-ml-[20%] h-full min-w-5/4 object-cover p-0"
      >
        <source
          src="/assets/images/cloud-subscription.webm"
          type="video/webm"
        />
      </video>
    </div>

    <div class="col-span-3 flex flex-col justify-between p-8">
      <div>
        <div class="flex flex-col gap-4">
          <div class="text-sm font-semibold text-text-primary">
            {{ t('cloudNotification.title') }}
          </div>
          <p class="m-0 text-sm text-text-secondary">
            {{ t('cloudNotification.message') }}
          </p>
        </div>

        <div class="mt-6 flex flex-col items-start gap-0 self-stretch">
          <div v-for="n in 4" :key="n" class="flex items-center gap-2 py-2">
            <i class="pi pi-check text-xs text-text-primary" />
            <span class="text-sm text-text-primary">
              {{ t(`cloudNotification.feature${n}Title`) }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 pt-8">
        <Button
          variant="primary"
          size="lg"
          class="w-full font-bold"
          @click="onExplore"
        >
          {{ t('cloudNotification.exploreCloud') }}
        </Button>
        <Button variant="textonly" size="sm" class="w-full" @click="onDismiss">
          {{ t('cloudNotification.continueLocally') }}
        </Button>
        <p class="m-0 text-center text-xs text-text-secondary">
          {{ t('cloudNotification.footer') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()

onMounted(() => {
  // Impression event — uses trackUiButtonClicked as no dedicated impression tracker exists
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_modal_impression'
  })
})

function onDismiss() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_continue_locally_clicked'
  })
  useDialogStore().closeDialog()
}

function onExplore() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_explore_cloud_clicked'
  })

  const params = new URLSearchParams({
    utm_source: 'desktop',
    utm_medium: 'onload-modal',
    utm_campaign: 'local-to-cloud-conversion',
    utm_id: 'desktop-onload-modal',
    utm_source_platform: 'mac-desktop'
  })

  window.open(
    `https://www.comfy.org/cloud?${params}`,
    '_blank',
    'noopener,noreferrer'
  )
  useDialogStore().closeDialog()
}
</script>
