<template>
  <div class="settings-container">
    <ScrollPanel class="settings-sidebar flex-shrink-0 p-2 w-48 2xl:w-64">
      <SearchBox
        class="settings-search-box w-full mb-2"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('g.searchSettings') + '...'"
      />
      <Listbox
        v-model="activeCategory"
        :options="categories"
        optionLabel="translatedLabel"
        scrollHeight="100%"
        :disabled="inSearch"
        class="border-none w-full"
      />
    </ScrollPanel>
    <Divider layout="vertical" class="mx-1 2xl:mx-4" />
    <Tabs :value="tabValue" :lazy="true" class="settings-content h-full w-full">
      <TabPanels class="settings-tab-panels h-full w-full pr-0">
        <PanelTemplate value="Search Results">
          <SettingsPanel :settingGroups="searchResults" />
        </PanelTemplate>

        <PanelTemplate
          v-for="category in settingCategories"
          :key="category.key"
          :value="category.label"
        >
          <template #header>
            <CurrentUserMessage v-if="tabValue === 'Comfy'" />
            <FirstTimeUIMessage v-if="tabValue === 'Comfy'" />
          </template>
          <SettingsPanel :settingGroups="sortedGroups(category)" />
        </PanelTemplate>

        <AboutPanel />
        <Suspense>
          <KeybindingPanel />
          <template #fallback>
            <div>Loading keybinding panel...</div>
          </template>
        </Suspense>

        <Suspense>
          <ExtensionPanel />
          <template #fallback>
            <div>Loading extension panel...</div>
          </template>
        </Suspense>

        <Suspense>
          <ServerConfigPanel />
          <template #fallback>
            <div>Loading server config panel...</div>
          </template>
        </Suspense>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue'
import Listbox from 'primevue/listbox'
import Tabs from 'primevue/tabs'
import TabPanels from 'primevue/tabpanels'
import Divider from 'primevue/divider'
import ScrollPanel from 'primevue/scrollpanel'
import { SettingTreeNode, useSettingStore } from '@/stores/settingStore'
import { ISettingGroup, SettingParams } from '@/types/settingTypes'
import SearchBox from '@/components/common/SearchBox.vue'
import SettingsPanel from './setting/SettingsPanel.vue'
import PanelTemplate from './setting/PanelTemplate.vue'
import AboutPanel from './setting/AboutPanel.vue'
import FirstTimeUIMessage from './setting/FirstTimeUIMessage.vue'
import CurrentUserMessage from './setting/CurrentUserMessage.vue'
import { flattenTree } from '@/utils/treeUtil'
import { isElectron } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { useI18n } from 'vue-i18n'

const KeybindingPanel = defineAsyncComponent(
  () => import('./setting/KeybindingPanel.vue')
)
const ExtensionPanel = defineAsyncComponent(
  () => import('./setting/ExtensionPanel.vue')
)
const ServerConfigPanel = defineAsyncComponent(
  () => import('./setting/ServerConfigPanel.vue')
)

const aboutPanelNode: SettingTreeNode = {
  key: 'about',
  label: 'About',
  children: []
}

const keybindingPanelNode: SettingTreeNode = {
  key: 'keybinding',
  label: 'Keybinding',
  children: []
}

const extensionPanelNode: SettingTreeNode = {
  key: 'extension',
  label: 'Extension',
  children: []
}

const serverConfigPanelNode: SettingTreeNode = {
  key: 'server-config',
  label: 'Server-Config',
  children: []
}

const extensionPanelNodeList = computed<SettingTreeNode[]>(() => {
  const settingStore = useSettingStore()
  const showExtensionPanel = settingStore.get('Comfy.Settings.ExtensionPanel')
  return showExtensionPanel ? [extensionPanelNode] : []
})

/**
 * Server config panel is only available in Electron. We might want to support
 * it in the web version in the future.
 */
const serverConfigPanelNodeList = computed<SettingTreeNode[]>(() => {
  return isElectron() ? [serverConfigPanelNode] : []
})

const settingStore = useSettingStore()
const settingRoot = computed<SettingTreeNode>(() => settingStore.settingTree)
const settingCategories = computed<SettingTreeNode[]>(
  () => settingRoot.value.children ?? []
)
const { t } = useI18n()
const categories = computed<SettingTreeNode[]>(() =>
  [
    ...settingCategories.value,
    keybindingPanelNode,
    ...extensionPanelNodeList.value,
    ...serverConfigPanelNodeList.value,
    aboutPanelNode
  ].map((node) => ({
    ...node,
    translatedLabel: t(
      `settingsCategories.${normalizeI18nKey(node.label)}`,
      node.label
    )
  }))
)

const activeCategory = ref<SettingTreeNode | null>(null)
const searchResults = ref<ISettingGroup[]>([])

watch(activeCategory, (newCategory, oldCategory) => {
  if (newCategory === null) {
    activeCategory.value = oldCategory
  }
})

onMounted(() => {
  activeCategory.value = categories.value[0]
})

const sortedGroups = (category: SettingTreeNode): ISettingGroup[] => {
  return [...(category.children ?? [])]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => ({
      label: group.label,
      settings: flattenTree<SettingParams>(group)
    }))
}

const searchQuery = ref<string>('')
const searchInProgress = ref<boolean>(false)
watch(searchQuery, () => (searchInProgress.value = true))

const handleSearch = (query: string) => {
  if (!query) {
    searchResults.value = []
    return
  }

  const allSettings = flattenTree<SettingParams>(settingRoot.value)
  const filteredSettings = allSettings.filter(
    (setting) =>
      setting.id.toLowerCase().includes(query.toLowerCase()) ||
      setting.name.toLowerCase().includes(query.toLowerCase())
  )

  const groupedSettings: { [key: string]: SettingParams[] } = {}
  filteredSettings.forEach((setting) => {
    const groupLabel = setting.id.split('.')[1]
    if (!groupedSettings[groupLabel]) {
      groupedSettings[groupLabel] = []
    }
    groupedSettings[groupLabel].push(setting)
  })

  searchResults.value = Object.entries(groupedSettings).map(
    ([label, settings]) => ({
      label,
      settings
    })
  )
  searchInProgress.value = false
}

const inSearch = computed(
  () => searchQuery.value.length > 0 && !searchInProgress.value
)
const tabValue = computed(() =>
  inSearch.value ? 'Search Results' : activeCategory.value?.label
)
</script>

<style>
.settings-tab-panels {
  padding-top: 0px !important;
}
</style>

<style scoped>
.settings-container {
  display: flex;
  height: 70vh;
  width: 60vw;
  max-width: 1024px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .settings-container {
    flex-direction: column;
    height: auto;
  }

  .settings-sidebar {
    width: 100%;
  }
}

/* Show a separator line above the Keybinding tab */
/* This indicates the start of custom setting panels */
.settings-sidebar :deep(.p-listbox-option[aria-label='Keybinding']) {
  position: relative;
}

.settings-sidebar :deep(.p-listbox-option[aria-label='Keybinding'])::before {
  @apply content-[''] top-0 left-0 absolute w-full;
  border-top: 1px solid var(--p-divider-border-color);
}
</style>
