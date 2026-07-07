<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
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
import WorkspaceActivityContent from '@/platform/workspace/components/dialogs/settings/WorkspaceActivityContent.vue'
import WorkspaceOverviewContent from '@/platform/workspace/components/dialogs/settings/WorkspaceOverviewContent.vue'
import WorkspaceInvoicesContent from '@/platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue'

type View = 'overview' | 'activity' | 'invoices'

const { t } = useI18n()

const tabs = computed(() => [
  {
    key: 'overview' as const,
    label: t('workspacePanel.planCredits.tabs.overview')
  },
  {
    key: 'activity' as const,
    label: t('workspacePanel.planCredits.tabs.activity')
  },
  {
    key: 'invoices' as const,
    label: t('workspacePanel.planCredits.tabs.invoices')
  }
])
const activeView = ref<View>('overview')
const searchQuery = ref('')

function setView(view: View) {
  activeView.value = view
  searchQuery.value = ''
}
</script>
