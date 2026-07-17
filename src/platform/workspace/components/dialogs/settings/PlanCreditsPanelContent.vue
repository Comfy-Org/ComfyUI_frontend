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

    <SubscriptionPanelContentWorkspace v-if="activeView === 'overview'" />
    <WorkspaceActivityContent v-else :search="searchQuery" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import SubscriptionPanelContentWorkspace from '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue'
import WorkspaceActivityContent from '@/platform/workspace/components/dialogs/settings/WorkspaceActivityContent.vue'

type View = 'overview' | 'activity'

const { t } = useI18n()

// The Invoices tab (owner/admin only) is added by FE-1245, which owns the
// next-invoice banner + Stripe portal link that fill it.
const tabs = computed<{ key: View; label: string }[]>(() => [
  { key: 'overview', label: t('workspacePanel.planCredits.tabs.overview') },
  { key: 'activity', label: t('workspacePanel.planCredits.tabs.activity') }
])

const activeView = ref<View>('overview')
const searchQuery = ref('')

function setView(view: View) {
  activeView.value = view
  searchQuery.value = ''
}
</script>
