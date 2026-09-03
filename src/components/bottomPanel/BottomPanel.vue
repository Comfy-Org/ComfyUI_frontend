<template>
  <div class="flex h-full flex-col">
    <Tabs :key="$i18n.locale" v-model="bottomPanelStore.activeBottomPanelTabId">
      <TabsList
        class="size-full border-b border-solid border-interface-stroke bg-transparent py-2"
      >
        <div class="flex w-full justify-between">
          <div class="tabs-container font-inter">
            <TabsTrigger
              v-for="tab in bottomPanelStore.bottomPanelTabs"
              :key="tab.id"
              :value="tab.id"
              :class="
                cn(
                  'm-1 mx-2 rounded-lg p-3 font-inter text-muted-foreground',
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
    </Tabs>
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import Button from '@/components/ui/button/Button.vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
