<template>
  <div class="flex h-full flex-col">
    <Tabs
      :key="$i18n.locale"
      v-model:value="bottomPanelStore.activeBottomPanelTabId"
      style="--p-tabs-tablist-background: var(--comfy-menu-bg)"
    >
      <TabList
        pt:tab-list="border-none h-full flex items-center py-2 border-b-1 border-solid"
        class="bg-transparent"
      >
        <div class="flex w-full justify-between">
          <div class="tabs-container">
            <Tab
              v-for="tab in bottomPanelStore.bottomPanelTabs"
              :key="tab.id"
              :value="tab.id"
              class="m-1 mx-2 border-none"
              :class="{
                'tab-list-single-item':
                  bottomPanelStore.bottomPanelTabs.length === 1
              }"
              :pt:root="
                (x: TabPassThroughMethodOptions) => ({
                  class: {
                    'p-3 rounded-lg': true,
                    'pointer-events-none':
                      bottomPanelStore.bottomPanelTabs.length === 1
                  },
                  style: {
                    color: 'var(--fg-color)',
                    backgroundColor:
                      !x.context.active ||
                      bottomPanelStore.bottomPanelTabs.length === 1
                        ? ''
                        : 'var(--bg-color)'
                  }
                })
              "
            >
              <span class="font-normal">
                {{ getTabDisplayTitle(tab) }}
              </span>
            </Tab>
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="isShortcutsTabActive"
              :label="$t('shortcuts.manageShortcuts')"
              icon="pi pi-cog"
              severity="secondary"
              size="small"
              text
              @click="openKeybindingSettings"
            />
            <Button
              class="justify-self-end"
              icon="pi pi-times"
              severity="secondary"
              size="small"
              text
              @click="closeBottomPanel"
            />
          </div>
        </div>
      </TabList>
    </Tabs>
    <!-- h-0 to force the div to grow -->
    <div class="h-0 grow">
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
import type { TabPassThroughMethodOptions } from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import { useDialogService } from '@/services/dialogService'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { BottomPanelExtension } from '@/types/extensionTypes'

const bottomPanelStore = useBottomPanelStore()
const dialogService = useDialogService()
const { t } = useI18n()

const isShortcutsTabActive = computed(() => {
  const activeTabId = bottomPanelStore.activeBottomPanelTabId
  return (
    activeTabId === 'shortcuts-essentials' ||
    activeTabId === 'shortcuts-view-controls'
  )
})

const shouldCapitalizeTab = (tabId: string): boolean => {
  return tabId !== 'shortcuts-essentials' && tabId !== 'shortcuts-view-controls'
}

const getTabDisplayTitle = (tab: BottomPanelExtension): string => {
  const title = tab.titleKey ? t(tab.titleKey) : tab.title || ''
  return shouldCapitalizeTab(tab.id) ? title.toUpperCase() : title
}

const openKeybindingSettings = async () => {
  dialogService.showSettingsDialog('keybinding')
}

const closeBottomPanel = () => {
  bottomPanelStore.activePanel = null
}
</script>

<style scoped>
:deep(.p-tablist-active-bar) {
  display: none;
}
</style>
