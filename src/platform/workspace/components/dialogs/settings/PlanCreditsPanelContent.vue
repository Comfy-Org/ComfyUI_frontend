<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      class="mb-4 flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-9"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Button
          v-for="tab in tabs"
          :key="tab.key"
          :variant="activeView === tab.key ? 'secondary' : 'muted-textonly'"
          size="lg"
          @click="activeView = tab.key"
        >
          {{ tab.label }}
        </Button>
      </div>
    </div>

    <template v-if="activeView === 'overview'">
      <SubscriptionPanelContentWorkspace v-if="isCloud" />
      <div v-else class="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto">
        <CreditsPanel embedded />
        <SettingsPlansSection />
        <SubscriptionFooterLinks
          class="mt-auto shrink-0"
          :show-invoice-history="false"
          :show-usage-activity="false"
        />
      </div>
    </template>
    <template v-else>
      <UsageLogsTable ref="usageLogsTable" />
      <div class="flex items-center pt-3 pb-6">
        <Button
          variant="muted-textonly"
          class="text-xs text-text-secondary"
          @click="openFullActivity"
        >
          {{ t('workspacePanel.activity.fullActivity') }}
          <i class="pi pi-external-link text-xs text-text-secondary" />
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CreditsPanel from '@/components/dialog/content/setting/CreditsPanel.vue'
import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import SubscriptionFooterLinks from '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue'
import { isCloud } from '@/platform/distribution/types'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import SettingsPlansSection from '@/platform/workspace/components/dialogs/settings/SettingsPlansSection.vue'

type View = 'overview' | 'activity'

const { t } = useI18n()

const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
])

const activeView = ref<View>('overview')

function openFullActivity() {
  window.open(
    `${getComfyPlatformBaseUrl()}/profile/usage`,
    '_blank',
    'noopener,noreferrer'
  )
}

const usageLogsTable = useTemplateRef('usageLogsTable')
watch(usageLogsTable, (table) => {
  table?.refresh().catch((error) => {
    console.error('Error refreshing usage logs:', error)
  })
})
</script>
