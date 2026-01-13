<template>
  <div class="flex h-full flex-col">
    <Tabs :value="activeTab" @update:value="setActiveTab">
      <TabList>
        <Tab value="dashboard">{{ $t('workspacePanel.tabs.dashboard') }}</Tab>
        <Tab value="plan">{{ $t('workspacePanel.tabs.planCredits') }}</Tab>
        <Tab value="members">{{ $t('workspacePanel.tabs.members') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="dashboard">
          <div class="p-4">{{ $t('workspacePanel.dashboard.placeholder') }}</div>
        </TabPanel>
        <TabPanel value="plan">
          <SubscriptionPanelContent />
        </TabPanel>
        <TabPanel value="members">
          <div class="p-4">{{ $t('workspacePanel.members.placeholder') }}</div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { onMounted } from 'vue'

import SubscriptionPanelContent from '@/platform/cloud/subscription/components/SubscriptionPanelContent.vue'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'

const { defaultTab = 'dashboard' } = defineProps<{
  defaultTab?: string
}>()

const { activeTab, setActiveTab } = useWorkspace()

onMounted(() => {
  setActiveTab(defaultTab)
})
</script>
