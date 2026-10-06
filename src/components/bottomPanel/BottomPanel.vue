<template>
  <Tabs v-model="bottomPanelStore.activeBottomPanelTabId" class="h-full gap-0">
    <TabsList variant="panel" class="w-full shrink-0">
      <div class="flex w-full justify-between">
        <div class="tabs-container font-inter">
          <TabsTrigger
            v-for="tab in bottomPanelStore.bottomPanelTabs"
            :key="tab.id"
            :value="tab.id"
            variant="panel"
            :class="
              cn(
                bottomPanelStore.bottomPanelTabs.length === 1 &&
                  'pointer-events-none data-[state=active]:bg-transparent data-[state=active]:text-muted-foreground'
              )
            "
          >
            <span class="font-normal">
              {{ getTabDisplayTitle(tab) }}
            </span>
          </TabsTrigger>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="isShortcutsTabActive"
            variant="muted-textonly"
            size="sm"
            @click="openKeybindingSettings"
          >
            <i class="pi pi-cog" />
            {{ $t('shortcuts.manageShortcuts') }}
          </Button>
          <Button
            class="justify-self-end"
            variant="muted-textonly"
            size="sm"
            :aria-label="t('g.close')"
            @click="closeBottomPanel"
          >
            <i class="pi pi-times" />
          </Button>
        </div>
      </div>
    </TabsList>
    <TabsContent
      v-if="
        bottomPanelStore.bottomPanelVisible &&
        bottomPanelStore.activeBottomPanelTab
      "
      :value="bottomPanelStore.activeBottomPanelTab.id"
      class="h-0 grow"
    >
      <ExtensionSlot :extension="bottomPanelStore.activeBottomPanelTab" />
    </TabsContent>
  </Tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import Button from '@/components/ui/button/Button.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { BottomPanelExtension } from '@/types/extensionTypes'
import { cn } from '@comfyorg/tailwind-utils'

const bottomPanelStore = useBottomPanelStore()
const settingsDialog = useSettingsDialog()
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
  settingsDialog.show('keybinding')
}

const closeBottomPanel = () => {
  bottomPanelStore.activePanel = null
}
</script>
