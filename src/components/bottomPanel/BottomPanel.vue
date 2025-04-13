<template>
  <div class="flex flex-col h-full">
    <Tabs v-model:value="bottomPanelStore.activeBottomPanelTabId">
      <TabList pt:tab-list="border-none">
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
    <!-- h-0 to force the div to flex-grow -->
    <div class="flex-grow h-0">
      <ExtensionSlot
        v-if="
          bottomPanelStore.bottomPanelVisible &&
          bottomPanelStore.activeBottomPanelTab
        "
        :extension="bottomPanelStore.activeBottomPanelTab"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

const bottomPanelStore = useBottomPanelStore()
</script>
