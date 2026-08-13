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
          @click="requestedView = tab.key"
        >
          {{ tab.label }}
        </Button>
      </div>
    </div>

    <SubscriptionPanelContentWorkspace v-if="activeView === 'overview'" />
    <UsageLogsTable v-else ref="usageLogsTable" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import Button from '@/components/ui/button/Button.vue'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type View = 'overview' | 'activity'

const { t } = useI18n()

const workspaceStore = useTeamWorkspaceStore()

// Stopgap until FE-1249 wires the per-workspace usage API: personal
// workspaces reuse the usage-log table local users already have, and team
// workspaces hide the tab instead of showing the designed ledger empty
// (WorkspaceActivityContent returns with the real data).
// The owner-only Invoices tab is added by FE-1245, which owns the
// next-invoice banner + Stripe portal link that fill it.
const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  ...(workspaceStore.isInPersonalWorkspace
    ? [
        {
          key: 'activity' as View,
          label: t('workspacePanel.planCredits.tabs.activity')
        }
      ]
    : [])
])

const requestedView = ref<View>('overview')
const activeView = computed<View>(() =>
  workspaceStore.isInPersonalWorkspace ? requestedView.value : 'overview'
)

const usageLogsTable = useTemplateRef('usageLogsTable')
watch(usageLogsTable, (table) => {
  if (table) void table.refresh()
})
</script>
