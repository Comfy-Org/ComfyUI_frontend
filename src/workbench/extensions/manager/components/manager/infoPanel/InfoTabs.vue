<template>
  <div class="overflow-hidden">
    <Tabs :value="activeTab">
      <TabList class="scrollbar-hide overflow-x-auto">
        <Tab v-if="hasCompatibilityIssues" value="warning" class="mr-6 p-2">
          <div class="flex items-center gap-1">
            <span>⚠️</span>
            {{ importFailed ? $t('g.error') : $t('g.warning') }}
          </div>
        </Tab>
        <Tab value="description" class="mr-6 p-2">
          {{ $t('g.description') }}
        </Tab>
        <Tab value="nodes" class="p-2">
          {{ $t('g.nodes') }}
        </Tab>
      </TabList>
      <TabPanels class="overflow-auto px-2 py-4">
        <TabPanel
          v-if="hasCompatibilityIssues"
          value="warning"
          class="bg-transparent"
        >
          <WarningTabPanel
            :node-pack="nodePack"
            :conflict-result="conflictResult"
          />
        </TabPanel>
        <TabPanel value="description">
          <DescriptionTabPanel :node-pack="nodePack" />
        </TabPanel>
        <TabPanel value="nodes">
          <NodesTabPanel :node-pack="nodePack" :node-names="nodeNames" />
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
import { computed, inject, ref, watchEffect } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import DescriptionTabPanel from '@/workbench/extensions/manager/components/manager/infoPanel/tabs/DescriptionTabPanel.vue'
import NodesTabPanel from '@/workbench/extensions/manager/components/manager/infoPanel/tabs/NodesTabPanel.vue'
import WarningTabPanel from '@/workbench/extensions/manager/components/manager/infoPanel/tabs/WarningTabPanel.vue'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'

const { nodePack, hasCompatibilityIssues, conflictResult } = defineProps<{
  nodePack: components['schemas']['Node']
  hasCompatibilityIssues?: boolean
  conflictResult?: ConflictDetectionResult | null
}>()

// Inject import failed context from parent
const importFailedContext = inject(ImportFailedKey)
const importFailed = importFailedContext?.importFailed

const nodeNames = computed(() => {
  // @ts-expect-error comfy_nodes is an Algolia-specific field
  const { comfy_nodes } = nodePack
  return comfy_nodes ?? []
})

const activeTab = ref('description')

// Watch for compatibility issues and automatically switch to warning tab
watchEffect(
  () => {
    if (hasCompatibilityIssues) {
      activeTab.value = 'warning'
    } else if (activeTab.value === 'warning') {
      // If currently on warning tab but no issues, switch to description
      activeTab.value = 'description'
    }
  },
  { flush: 'post' }
)
</script>
