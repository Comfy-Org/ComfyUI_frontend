<template>
  <div class="w-[480px] p-6">
    <!-- Header with Logo -->
    <div class="mb-6">
      <div class="mb-2 flex items-center gap-3">
        <img
          src="/assets/images/comfy-cloud-logo.svg"
          alt="Comfy Cloud"
          class="h-8 w-8 shrink-0"
        />
        <h1 class="text-2xl font-semibold">
          {{ t('cloudNotification.title') }}
        </h1>
      </div>
      <p class="text-base text-muted">
        {{ t('cloudNotification.message') }}
      </p>
    </div>

    <!-- Features -->
    <div class="mb-6 space-y-4">
      <div class="flex gap-3">
        <i class="pi pi-check-circle mt-0.5 shrink-0 text-xl text-blue-500"></i>
        <div class="flex-1">
          <div class="mb-1 font-medium">
            {{ t('cloudNotification.feature1Title') }}
          </div>
          <div class="text-sm text-muted">
            {{ t('cloudNotification.feature1') }}
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <i class="pi pi-server mt-0.5 shrink-0 text-xl text-blue-500"></i>
        <div class="flex-1">
          <div class="mb-1 font-medium">
            {{ t('cloudNotification.feature2Title') }}
          </div>
          <div class="text-sm text-muted">
            {{ t('cloudNotification.feature2') }}
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <i class="pi pi-tag mt-0.5 shrink-0 text-xl text-blue-500"></i>
        <div class="flex-1">
          <div class="mb-1 font-medium">
            {{ t('cloudNotification.feature3Title') }}
          </div>
          <div class="text-sm text-muted">
            {{ t('cloudNotification.feature3') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Note -->
    <div
      class="mb-6 rounded border-l-2 border-blue-500 bg-blue-500/5 py-2.5 pl-3 pr-4"
    >
      <p class="whitespace-pre-line text-sm text-muted">
        {{ t('cloudNotification.feature4') }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      <Button
        :label="t('cloudNotification.continueLocally')"
        severity="secondary"
        outlined
        class="flex-1"
        @click="onDismiss"
      />
      <Button
        :label="t('cloudNotification.exploreCloud')"
        icon="pi pi-arrow-right"
        icon-pos="right"
        class="flex-1"
        @click="onExplore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()

// Track when modal is shown
onMounted(() => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_modal_shown'
  })
})

const onDismiss = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_continue_locally_clicked'
  })
  useDialogStore().closeDialog()
}

const onExplore = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_explore_cloud_clicked'
  })

  // Add UTM parameters for attribution tracking
  const url = new URL('https://www.comfy.org/cloud')
  url.searchParams.set('utm_source', 'desktop')
  url.searchParams.set('utm_medium', 'notification')
  url.searchParams.set('utm_campaign', 'macos_first_launch')

  window.open(url.toString(), '_blank')
  useDialogStore().closeDialog()
}
</script>
