<template>
  <div class="overflow-hidden">
    <Tabs :value="activeTab">
      <TabList>
        <Tab value="description">
          {{ $t('g.description') }}
        </Tab>
        <Tab value="nodes">
          {{ $t('g.nodes') }}
        </Tab>
      </TabList>
      <TabPanels class="overflow-auto">
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
import { computed, ref } from 'vue'

import DescriptionTabPanel from '@/components/dialog/content/manager/infoPanel/tabs/DescriptionTabPanel.vue'
import NodesTabPanel from '@/components/dialog/content/manager/infoPanel/tabs/NodesTabPanel.vue'
import { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const nodeNames = computed(() => {
  // @ts-expect-error comfy_nodes is an Algolia-specific field
  const { comfy_nodes } = nodePack
  return comfy_nodes ?? []
})

const activeTab = ref('description')
</script>
