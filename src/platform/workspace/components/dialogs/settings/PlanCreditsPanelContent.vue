<template>
  <div
    :class="
      cn(
        'flex min-h-0 flex-1 flex-col gap-4',
        // The panel runs flush to the bottom edge (BaseModalLayout 'flush'); the
        // Activity/Invoices tables keep their prior bottom gap, Overview doesn't.
        activeView !== 'overview' && 'pb-10'
      )
    "
  >
    <div class="flex w-full items-center gap-9">
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
        v-if="activeView !== 'overview'"
        v-model="searchQuery"
        :placeholder="$t('g.search')"
        size="lg"
        class="w-64"
      />
    </div>

    <BillingStatusBanner />

    <WorkspaceOverviewContent
      v-if="activeView === 'overview'"
      @navigate="setView"
    />
    <WorkspaceActivityContent
      v-else-if="activeView === 'activity'"
      :search="searchQuery"
    />
    <WorkspaceInvoicesContent v-else :search="searchQuery" />
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
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { cn } from '@comfyorg/tailwind-utils'

type View = 'overview' | 'activity' | 'invoices'

const { t } = useI18n()

const { permissions } = useWorkspaceUI()

const tabs = computed(() => {
  const base: { key: View; label: string }[] = [
    { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
    { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
  ]
  // Invoices are billing details — owners/admins only.
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
