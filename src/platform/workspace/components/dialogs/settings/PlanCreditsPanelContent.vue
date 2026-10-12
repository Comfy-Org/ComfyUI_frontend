<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <Teleport
      defer
      to="#settings-header-controls"
      :disabled="!isHeaderCollapsed"
    >
      <div
        :class="
          cn(
            'flex w-full gap-3',
            isHeaderCollapsed
              ? 'min-w-0 flex-1 flex-row items-center gap-9'
              : 'mb-4 flex-col @2xl:flex-row @2xl:items-center @2xl:gap-9'
          )
        "
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
    </Teleport>

    <template v-if="activeView === 'overview'">
      <SubscriptionPanelContentWorkspace v-if="isCloud" />
      <div
        v-else
        class="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto"
        @scroll="handlePanelScroll"
      >
        <CreditsPanel embedded />
        <SubscriptionFooterLinks
          class="mt-auto shrink-0"
          :show-invoice-history="false"
          :show-usage-activity="false"
        />
      </div>
    </template>
    <WorkspaceInvoicesContent v-else-if="activeView === 'invoices'" />
    <UsageLogsTable v-else ref="usageLogsTable" />
  </div>
</template>

<script setup lang="ts">
import { useSettingsHeaderCollapse } from '@/platform/settings/composables/useSettingsHeaderCollapse'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CreditsPanel from '@/components/dialog/content/setting/CreditsPanel.vue'
import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import Button from '@/components/ui/button/Button.vue'
import SubscriptionFooterLinks from '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue'
import { isCloud } from '@/platform/distribution/types'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import WorkspaceInvoicesContent from '@/platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

type View = 'overview' | 'activity' | 'invoices'

const { isHeaderCollapsed, handlePanelScroll, resetHeaderCollapse } =
  useSettingsHeaderCollapse()

const { t } = useI18n()
const { permissions } = useWorkspaceUI()

// Invoices covers a workspace-wide charge, so it is billing-manager only, and
// the upcoming amount and Stripe portal only exist on cloud.
const canSeeInvoices = computed(
  () => isCloud && permissions.value.canManageSubscription
)

const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') },
  ...(canSeeInvoices.value
    ? [
        {
          key: 'invoices' as const,
          label: t('workspacePanel.planCredits.tabs.invoices')
        }
      ]
    : [])
])

const activeView = ref<View>('overview')

// Switching workspaces can drop the billing-manager role while the dialog
// stays open; leaving Invoices selected would keep the panel rendered after
// its tab disappeared.
watch(canSeeInvoices, (allowed) => {
  if (!allowed && activeView.value === 'invoices') activeView.value = 'overview'
})

// Each view owns a different scroller, so a collapsed header would otherwise
// survive the switch and sit above content at scrollTop 0.
watch(activeView, resetHeaderCollapse)

const usageLogsTable = useTemplateRef('usageLogsTable')
watch(usageLogsTable, (table) => {
  table?.refresh().catch(() => {
    console.error('Error refreshing usage logs')
  })
})
</script>
