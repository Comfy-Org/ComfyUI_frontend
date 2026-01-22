<template>
  <div class="overflow-hidden h-full flex flex-col">
    <div class="flex-1 min-h-0">
      <TabList v-model="activeTab" class="scrollbar-hide overflow-x-auto">
        <Tab v-if="hasCompatibilityIssues" value="warning">
          <div class="flex items-center gap-1">
            <span>⚠️</span>
            {{ importFailed ? $t('g.error') : $t('g.warning') }}
          </div>
        </Tab>
        <Tab value="description">
          {{ $t('g.description') }}
        </Tab>
        <Tab value="nodes">
          {{ $t('g.nodes') }}
        </Tab>
      </TabList>
    </div>

    <div class="p-2 scrollbar-custom">
      <WarningTabPanel
        v-if="activeTab === 'warning' && hasCompatibilityIssues"
        :node-pack="nodePack"
        :conflict-result="conflictResult"
      />
      <DescriptionTabPanel
        v-else-if="activeTab === 'description'"
        :node-pack="nodePack"
      />
      <NodesTabPanel
        v-else-if="activeTab === 'nodes'"
        :node-pack="nodePack"
        :node-names="nodeNames"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watchEffect } from 'vue'

import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
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
