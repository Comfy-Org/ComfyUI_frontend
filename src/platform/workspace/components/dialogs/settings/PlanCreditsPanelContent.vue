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
        <SubscriptionFooterLinks
          class="mt-auto shrink-0"
          :show-invoice-history="false"
          :show-usage-activity="false"
        />
      </div>
    </template>
    <UsageLogsTable v-else ref="usageLogsTable" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CreditsPanel from '@/components/dialog/content/setting/CreditsPanel.vue'
import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import SubscriptionFooterLinks from '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue'
import { isCloud } from '@/platform/distribution/types'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'

type View = 'overview' | 'activity'

const { t } = useI18n()
const { usageLogsRefreshSignal } = useBillingContext()

const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
])

const activeView = ref<View>('overview')

const usageLogsTable = useTemplateRef('usageLogsTable')
watch(usageLogsRefreshSignal, () => {
  void usageLogsTable.value?.refresh()
})
</script>
