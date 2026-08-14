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
      <CreditsPanel v-else embedded />
    </template>
    <template v-else>
      <UsageLogsTable ref="usageLogsTable" fit-container />
      <div class="flex items-center pt-3">
        <Button
          variant="muted-textonly"
          class="text-xs text-text-secondary"
          @click="openFullActivity"
        >
          {{ $t('workspacePanel.activity.fullActivity') }}
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
import { isCloud } from '@/platform/distribution/types'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'

type View = 'overview' | 'activity'

const { t } = useI18n()

// Stopgap until FE-1249 wires the per-workspace usage API: the Activity tab
// reuses the usage-log table local users already have (WorkspaceActivityContent
// returns with the real ledger data).
// The owner-only Invoices tab is added by FE-1245, which owns the
// next-invoice banner + Stripe portal link that fill it.
const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
])

const activeView = ref<View>('overview')

const fullActivityUrl = `${getComfyPlatformBaseUrl()}/profile/usage`

function openFullActivity() {
  window.open(fullActivityUrl, '_blank', 'noopener,noreferrer')
}

const usageLogsTable = useTemplateRef('usageLogsTable')
watch(usageLogsTable, (table) => {
  if (table) void table.refresh()
})
</script>
