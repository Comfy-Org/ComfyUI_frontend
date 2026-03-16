<template>
  <div class="w-[480px] p-6">
    <div class="mb-6">
      <div class="mb-2 flex items-center gap-3">
        <img
          src="/assets/images/comfy-cloud-logo.svg"
          :alt="t('cloudNotification.title')"
          class="size-8 shrink-0"
        />
        <h1 class="text-2xl font-semibold">
          {{ t('cloudNotification.title') }}
        </h1>
      </div>
      <p class="text-base text-muted">
        {{ t('cloudNotification.message') }}
      </p>
    </div>

    <div class="mb-6 space-y-4">
      <div class="flex gap-3">
        <i class="pi pi-bolt mt-0.5 shrink-0 text-xl text-blue-500" />
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
        <i class="pi pi-box mt-0.5 shrink-0 text-xl text-blue-500" />
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
        <i class="pi pi-gift mt-0.5 shrink-0 text-xl text-blue-500" />
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

    <div
      class="mb-6 rounded-sm border-l-2 border-blue-500 bg-blue-500/5 py-2.5 pr-4 pl-3"
    >
      <p class="text-sm whitespace-pre-line text-muted">
        {{ t('cloudNotification.footer') }}
      </p>
    </div>

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

onMounted(() => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_modal_shown'
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

  const url = new URL('https://www.comfy.org/cloud')
  url.searchParams.set('utm_source', 'desktop')
  url.searchParams.set('utm_medium', 'notification')
  url.searchParams.set('utm_campaign', 'macos_first_launch')
  url.searchParams.set('utm_id', 'desktop_cloud_notification')
  url.searchParams.set('utm_source_platform', 'electron')

  window.open(url.toString(), '_blank')
  useDialogStore().closeDialog()
}
</script>
