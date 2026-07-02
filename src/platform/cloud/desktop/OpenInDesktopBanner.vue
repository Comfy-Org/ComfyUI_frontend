<template>
  <div
    v-if="visible"
    class="fixed inset-x-0 top-0 z-1100 flex items-center justify-center gap-3 bg-secondary-background px-4 py-2 text-base-foreground shadow-sm"
    role="region"
    :aria-label="t('openInDesktop.action')"
  >
    <i
      class="icon-[lucide--monitor] size-4 text-text-secondary"
      aria-hidden="true"
    />
    <span class="font-inter text-[12px] leading-normal">
      {{ t('openInDesktop.message') }}
    </span>
    <button
      type="button"
      class="rounded-md bg-primary-background px-3 py-1 font-inter text-[12px] font-medium text-base-foreground transition-colors hover:bg-primary-background-hover"
      @click="openInDesktop"
    >
      {{ t('openInDesktop.action') }}
    </button>
    <a
      :href="DESKTOP_DOWNLOAD_URL"
      target="_blank"
      rel="noopener noreferrer"
      class="font-inter text-[12px] text-text-secondary underline-offset-2 hover:underline"
    >
      {{ t('openInDesktop.getApp') }}
    </a>
    <button
      type="button"
      class="ml-1 flex size-6 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-secondary-background-hover"
      :aria-label="t('openInDesktop.dismiss')"
      @click="dismiss"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import {
  DESKTOP_DOWNLOAD_URL,
  useOpenInDesktopBanner
} from '@/platform/cloud/desktop/useOpenInDesktopBanner'

const { t } = useI18n()
const { visible, openInDesktop, dismiss } = useOpenInDesktopBanner()
</script>
