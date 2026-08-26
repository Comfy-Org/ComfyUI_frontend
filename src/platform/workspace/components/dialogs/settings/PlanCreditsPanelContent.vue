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
        <SettingsPlansSection
          :catalog-plans="catalogPlans"
          :team-credit-stops="teamCreditStops"
          :is-loading="isCatalogLoading"
          :error="catalogError"
          @retry="retry"
        />
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
import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import { isCloud } from '@/platform/distribution/types'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import SettingsPlansSection from '@/platform/workspace/components/dialogs/settings/SettingsPlansSection.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type View = 'overview' | 'activity'

const { t } = useI18n()

const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
])

const activeView = ref<View>('overview')

// Read from the singleton, so fetch through it: the rail-routed context lands
// on useLegacyBilling's no-op off-cloud.
const {
  plans: catalogPlans,
  teamCreditStops,
  isLoading: isLoadingPlans,
  error: plansError,
  fetchPlans
} = useBillingPlans()

// The catalog is workspace-scoped, so the wallet bootstrap is its precondition.
const workspaceStore = useTeamWorkspaceStore()
const hasWorkspace = computed(
  () => workspaceStore.activeWorkspace?.type !== undefined
)
// 'uninitialized' is the pre-boot window before WorkspaceAuthGate calls
// initialize(), not a failure; 'ready' with no workspace would hang otherwise.
const workspaceFailed = computed(
  () =>
    workspaceStore.initState === 'error' ||
    (workspaceStore.initState === 'ready' && !hasWorkspace.value)
)

const isCatalogLoading = computed(() =>
  isCloud
    ? isLoadingPlans.value
    : isLoadingPlans.value || (!hasWorkspace.value && !workspaceFailed.value)
)
const catalogError = computed(() => {
  if (!isCloud && workspaceFailed.value) {
    return workspaceStore.error?.message ?? t('subscription.planLoadError')
  }
  return plansError.value
})

function retry() {
  if (!isCloud && !hasWorkspace.value) {
    // No workspace yet: re-run the bootstrap; the watch fetches once it lands.
    void workspaceStore.initialize().catch(() => undefined)
    return
  }
  void fetchPlans()
}

// Off-cloud only; on cloud this section never mounts.
watch(
  hasWorkspace,
  (ready) => {
    if (!isCloud && ready) void fetchPlans()
  },
  { immediate: true }
)

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
