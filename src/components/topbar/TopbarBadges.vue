<template>
  <div class="flex h-full shrink-0 items-center">
    <!-- Cloud Notification Badge for Desktop -->
    <div
      v-if="cloudBadge"
      class="relative inline-flex h-full shrink-0 cursor-pointer items-center justify-center gap-2 px-3 transition-opacity hover:opacity-70"
      @click="handleCloudBadgeClick"
    >
      <div
        class="rounded-full bg-white px-1.5 py-0.5 text-xxxs font-semibold text-black"
      >
        {{ t('cloudNotification.badgeLabel') }}
      </div>
      <div v-if="displayMode !== 'icon-only'" class="text-sm font-inter">
        {{ t('cloudNotification.badgeText') }}
      </div>
    </div>

    <!-- Extension Badges -->
    <TopbarBadge
      v-for="badge in topbarBadgeStore.badges"
      :key="badge.text"
      :badge
      :display-mode="displayMode"
      :reverse-order="reverseOrder"
      :no-padding="noPadding"
    />
  </div>
</template>

<script lang="ts" setup>
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'
import type { TopbarBadge as TopbarBadgeType } from '@/types/comfy'
import { isElectron } from '@/utils/envUtil'

import TopbarBadge from './TopbarBadge.vue'

withDefaults(
  defineProps<{
    reverseOrder?: boolean
    noPadding?: boolean
  }>(),
  {
    reverseOrder: false,
    noPadding: false
  }
)

const breakpoints = useBreakpoints(breakpointsTailwind)
const isXl = breakpoints.greaterOrEqual('xl')
const isLg = breakpoints.greaterOrEqual('lg')

const displayMode = computed<'full' | 'compact' | 'icon-only'>(() => {
  if (isXl.value) return 'full'
  if (isLg.value) return 'compact'
  return 'icon-only'
})

const topbarBadgeStore = useTopbarBadgeStore()

// Cloud notification badge
const { t } = useI18n()
const settingStore = useSettingStore()
const dialogService = useDialogService()

const isMacOS = computed(() => navigator.platform.toLowerCase().includes('mac'))

// Access the reactive store state directly for proper reactivity
const hasShownNotification = computed(
  () =>
    settingStore.settingValues['Comfy.Desktop.CloudNotificationShown'] ?? false
)

const shouldShowCloudBadge = computed(
  () => isElectron() && isMacOS.value && hasShownNotification.value
)

const cloudBadge = computed<TopbarBadgeType | null>(() => {
  if (!shouldShowCloudBadge.value) return null

  return {
    text: 'Discover Comfy Cloud',
    label: 'NEW',
    icon: 'pi pi-cloud',
    variant: 'info',
    tooltip: 'Learn about Comfy Cloud'
  }
})

const handleCloudBadgeClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'cloud_notification_badge_clicked'
  })
  dialogService.showCloudNotification()
}
</script>
