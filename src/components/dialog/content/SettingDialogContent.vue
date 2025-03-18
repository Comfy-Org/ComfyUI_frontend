<template>
  <div class="settings-container">
    <ScrollPanel class="settings-sidebar flex-shrink-0 p-2 w-48 2xl:w-64">
      <SearchBox
        class="settings-search-box w-full mb-2"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('g.searchSettings') + '...'"
        :debounce-time="128"
      />
      <Listbox
        v-model="activeCategory"
        :options="categories"
        optionLabel="translatedLabel"
        scrollHeight="100%"
        :optionDisabled="
          (option: SettingTreeNode) =>
            !queryIsEmpty && !searchResultsCategories.has(option.label ?? '')
        "
        class="border-none w-full"
      />
    </ScrollPanel>
    <Divider layout="vertical" class="mx-1 2xl:mx-4 hidden md:flex" />
    <Divider layout="horizontal" class="flex md:hidden" />
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
            <ColorPaletteMessage v-if="tabValue === 'Appearance'" />
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
import Divider from 'primevue/divider'
import Listbox from 'primevue/listbox'
import ScrollPanel from 'primevue/scrollpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import { st } from '@/i18n'
import {
  SettingTreeNode,
  getSettingInfo,
  useSettingStore
} from '@/stores/settingStore'
import { ISettingGroup, SettingParams } from '@/types/settingTypes'
import { isElectron } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { flattenTree } from '@/utils/treeUtil'

import AboutPanel from './setting/AboutPanel.vue'
import ColorPaletteMessage from './setting/ColorPaletteMessage.vue'
import CurrentUserMessage from './setting/CurrentUserMessage.vue'
import FirstTimeUIMessage from './setting/FirstTimeUIMessage.vue'
import PanelTemplate from './setting/PanelTemplate.vue'
import SettingsPanel from './setting/SettingsPanel.vue'

const props = defineProps<{
  defaultPanel?: 'about' | 'keybinding' | 'extension' | 'server-config'
}>()

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
    extensionPanelNode,
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
const getDefaultCategory = () => {
  return props.defaultPanel
    ? categories.value.find((x) => x.key === props.defaultPanel) ??
        categories.value[0]
    : categories.value[0]
}
onMounted(() => {
  activeCategory.value = getDefaultCategory()
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
const filteredSettingIds = ref<string[]>([])
const searchInProgress = ref<boolean>(false)
watch(searchQuery, () => (searchInProgress.value = true))

const searchResults = computed<ISettingGroup[]>(() => {
  const groupedSettings: { [key: string]: SettingParams[] } = {}

  filteredSettingIds.value.forEach((id) => {
    const setting = settingStore.settingsById[id]
    const info = getSettingInfo(setting)
    const groupLabel = info.subCategory

    if (
      activeCategory.value === null ||
      activeCategory.value.label === info.category
    ) {
      if (!groupedSettings[groupLabel]) {
        groupedSettings[groupLabel] = []
      }
      groupedSettings[groupLabel].push(setting)
    }
  })

  return Object.entries(groupedSettings).map(([label, settings]) => ({
    label,
    settings
  }))
})

/**
 * Settings categories that contains at least one setting in search results.
 */
const searchResultsCategories = computed<Set<string>>(() => {
  return new Set(
    filteredSettingIds.value.map(
      (id) => getSettingInfo(settingStore.settingsById[id]).category
    )
  )
})

const handleSearch = (query: string) => {
  if (!query) {
    filteredSettingIds.value = []
    activeCategory.value ??= getDefaultCategory()
    return
  }

  const queryLower = query.toLocaleLowerCase()
  const allSettings = flattenTree<SettingParams>(settingRoot.value)
  const filteredSettings = allSettings.filter((setting) => {
    const idLower = setting.id.toLowerCase()
    const nameLower = setting.name.toLowerCase()
    const translatedName = st(
      `settings.${normalizeI18nKey(setting.id)}.name`,
      setting.name
    ).toLocaleLowerCase()
    const info = getSettingInfo(setting)
    const translatedCategory = st(
      `settingsCategories.${normalizeI18nKey(info.category)}`,
      info.category
    ).toLocaleLowerCase()
    const translatedSubCategory = st(
      `settingsCategories.${normalizeI18nKey(info.subCategory)}`,
      info.subCategory
    ).toLocaleLowerCase()

    return (
      idLower.includes(queryLower) ||
      nameLower.includes(queryLower) ||
      translatedName.includes(queryLower) ||
      translatedCategory.includes(queryLower) ||
      translatedSubCategory.includes(queryLower)
    )
  })

  filteredSettingIds.value = filteredSettings.map((x) => x.id)
  searchInProgress.value = false
  activeCategory.value = null
}

const queryIsEmpty = computed(() => searchQuery.value.length === 0)
const inSearch = computed(() => !queryIsEmpty.value && !searchInProgress.value)
const tabValue = computed<string>(() =>
  inSearch.value ? 'Search Results' : activeCategory.value?.label ?? ''
)
// Don't allow null category to be set outside of search.
// In search mode, the active category can be null to show all search results.
watch(activeCategory, (_, oldValue) => {
  if (!tabValue.value) {
    activeCategory.value = oldValue
  }
})
</script>

<style>
.settings-tab-panels {
  padding-top: 0 !important;
}
</style>

<style scoped>
.settings-container {
  display: flex;
  height: 70vh;
  width: 60vw;
  max-width: 64rem;
  overflow: hidden;
}

@media (max-width: 768px) {
  .settings-container {
    flex-direction: column;
    height: auto;
    width: 80vw;
  }

  .settings-sidebar {
    width: 100%;
  }

  .settings-content {
    height: 350px;
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
