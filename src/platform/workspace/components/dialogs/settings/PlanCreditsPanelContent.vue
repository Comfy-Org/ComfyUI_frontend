<template>
  <div
    :class="
      cn(
        '@container flex min-h-0 flex-1 flex-col gap-4',
        // The panel runs flush to the bottom edge (BaseModalLayout 'flush'); the
        // Activity/Invoices tables keep their prior bottom gap, Overview doesn't.
        activeView !== 'overview' && 'pb-6'
      )
    "
  >
    <div
      class="flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-9"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Button
          v-for="tab in tabs"
          :key="tab.key"
          :variant="activeView === tab.key ? 'secondary' : 'muted-textonly'"
          size="lg"
          @click="setView(tab.key)"
        >
          {{ tab.label }}
        </Button>
      </div>
      <SearchInput
        v-if="activeView === 'activity'"
        v-model="searchQuery"
        :placeholder="$t('g.search')"
        size="lg"
        class="w-full @2xl:w-64"
      />
    </div>

    <BillingStatusBanner>
      <template #actions>
        <Button
          v-if="activeView === 'invoices' && isPaused"
          variant="textonly"
          size="lg"
          @click="openInvoiceHistory"
        >
          {{ $t('workspacePanel.invoices.fullHistory') }}
          <i class="icon-[lucide--external-link] size-4" />
        </Button>
      </template>
    </BillingStatusBanner>

    <WorkspaceOverviewContent
      v-if="activeView === 'overview'"
      @navigate="setView"
    />
    <WorkspaceActivityContent
      v-else-if="activeView === 'activity'"
      :search="searchQuery"
    />
    <WorkspaceInvoicesContent v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'
import WorkspaceActivityContent from '@/platform/workspace/components/dialogs/settings/WorkspaceActivityContent.vue'
import WorkspaceOverviewContent from '@/platform/workspace/components/dialogs/settings/WorkspaceOverviewContent.vue'
import WorkspaceInvoicesContent from '@/platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { cn } from '@comfyorg/tailwind-utils'

type View = 'overview' | 'activity' | 'invoices'

const { t } = useI18n()

const { permissions } = useWorkspaceUI()
const { isPaused, manageSubscription } = useBillingContext()

function openInvoiceHistory() {
  void manageSubscription()
}

const tabs = computed(() => {
  const base: { key: View; label: string }[] = [
    { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
    { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
  ]
  // Invoices are billing details — owners only.
  if (permissions.value.canManageSubscription) {
    base.push({
      key: 'invoices',
      label: t('workspacePanel.planCredits.tabs.invoices')
    })
  }
  return base
})
const activeView = ref<View>('overview')
const searchQuery = ref('')

function setView(view: View) {
  activeView.value = view
  searchQuery.value = ''
}
</script>
