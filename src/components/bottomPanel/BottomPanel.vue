<template>
  <Tabs v-model:value="bottomPanelStore.activeBottomPanelTabId">
    <TabList pt:tabList="border-none">
      <div class="w-full flex justify-between">
        <div class="tabs-container">
          <Tab
            v-for="tab in bottomPanelStore.bottomPanelTabs"
            :key="tab.id"
            :value="tab.id"
            class="p-3 border-none"
          >
            <span class="font-bold">
              {{ tab.title.toUpperCase() }}
            </span>
          </Tab>
        </div>
        <Button
          class="justify-self-end"
          icon="pi pi-times"
          severity="secondary"
          size="small"
          text
          @click="bottomPanelStore.bottomPanelVisible = false"
        />
      </div>
    </TabList>
  </Tabs>
  <ExtensionSlot
    v-if="
      bottomPanelStore.bottomPanelVisible &&
      bottomPanelStore.activeBottomPanelTab
    "
    :extension="bottomPanelStore.activeBottomPanelTab"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

const bottomPanelStore = useBottomPanelStore()
</script>
