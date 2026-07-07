<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex w-full items-center gap-9">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Button
          v-for="tab in tabs"
          :key="tab"
          :variant="activeView === tab ? 'secondary' : 'muted-textonly'"
          size="lg"
          @click="setView(tab)"
        >
          {{ $t(`workspacePanel.planCredits.tabs.${tab}`) }}
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

    <div v-if="activeView === 'overview'" class="flex min-h-0 flex-1 flex-col">
      <SubscriptionPanelContentWorkspace />
    </div>
    <WorkspaceActivityContent
      v-else-if="activeView === 'activity'"
      :search="searchQuery"
    />
    <WorkspaceInvoicesContent v-else :search="searchQuery" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import WorkspaceActivityContent from '@/platform/workspace/components/dialogs/settings/WorkspaceActivityContent.vue'
import WorkspaceInvoicesContent from '@/platform/workspace/components/dialogs/settings/WorkspaceInvoicesContent.vue'

type View = 'overview' | 'activity' | 'invoices'

const tabs: View[] = ['overview', 'activity', 'invoices']
const activeView = ref<View>('overview')
const searchQuery = ref('')

function setView(view: View) {
  activeView.value = view
  searchQuery.value = ''
}
</script>
