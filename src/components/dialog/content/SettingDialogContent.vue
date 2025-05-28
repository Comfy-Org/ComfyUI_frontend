<template>
  <div class="settings-container">
    <ScrollPanel class="settings-sidebar flex-shrink-0 p-2 w-48 2xl:w-64">
      <SearchBox
        v-model:modelValue="searchQuery"
        class="settings-search-box w-full mb-2"
        :placeholder="$t('g.searchSettings') + '...'"
        :debounce-time="128"
        @search="handleSearch"
      />
      <Listbox
        v-model="activeCategory"
        :options="groupedMenuTreeNodes"
        option-label="translatedLabel"
        option-group-label="label"
        option-group-children="children"
        scroll-height="100%"
        :option-disabled="
          (option: SettingTreeNode) =>
            !queryIsEmpty && !searchResultsCategories.has(option.label ?? '')
        "
        class="border-none w-full"
      >
        <template #optiongroup>
          <Divider class="my-0" />
        </template>
      </Listbox>
    </ScrollPanel>
    <Divider layout="vertical" class="mx-1 2xl:mx-4 hidden md:flex" />
    <Divider layout="horizontal" class="flex md:hidden" />
    <Tabs :value="tabValue" :lazy="true" class="settings-content h-full w-full">
      <TabPanels class="settings-tab-panels h-full w-full pr-0">
        <PanelTemplate value="Search Results">
          <SettingsPanel :setting-groups="searchResults" />
        </PanelTemplate>

        <PanelTemplate
          v-for="category in settingCategories"
          :key="category.key"
          :value="category.label ?? ''"
        >
          <template #header>
            <CurrentUserMessage v-if="tabValue === 'Comfy'" />
            <FirstTimeUIMessage v-if="tabValue === 'Comfy'" />
            <ColorPaletteMessage v-if="tabValue === 'Appearance'" />
          </template>
          <SettingsPanel :setting-groups="sortedGroups(category)" />
        </PanelTemplate>

        <Suspense v-for="panel in panels" :key="panel.node.key">
          <component :is="panel.component" />
          <template #fallback>
            <div>Loading {{ panel.node.label }} panel...</div>
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
import { computed, watch } from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useSettingSearch } from '@/composables/setting/useSettingSearch'
import { useSettingUI } from '@/composables/setting/useSettingUI'
import { SettingTreeNode } from '@/stores/settingStore'
import { ISettingGroup, SettingParams } from '@/types/settingTypes'
import { flattenTree } from '@/utils/treeUtil'

import ColorPaletteMessage from './setting/ColorPaletteMessage.vue'
import CurrentUserMessage from './setting/CurrentUserMessage.vue'
import FirstTimeUIMessage from './setting/FirstTimeUIMessage.vue'
import PanelTemplate from './setting/PanelTemplate.vue'
import SettingsPanel from './setting/SettingsPanel.vue'

const { defaultPanel } = defineProps<{
  defaultPanel?:
    | 'about'
    | 'keybinding'
    | 'extension'
    | 'server-config'
    | 'user'
    | 'credits'
}>()

const {
  activeCategory,
  defaultCategory,
  settingCategories,
  groupedMenuTreeNodes,
  panels
} = useSettingUI(defaultPanel)

const {
  searchQuery,
  searchResultsCategories,
  queryIsEmpty,
  inSearch,
  handleSearch: handleSearchBase,
  getSearchResults
} = useSettingSearch()

const authActions = useFirebaseAuthActions()

// Sort groups for a category
const sortedGroups = (category: SettingTreeNode): ISettingGroup[] => {
  return [...(category.children ?? [])]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => ({
      label: group.label,
      settings: flattenTree<SettingParams>(group)
    }))
}

const handleSearch = (query: string) => {
  handleSearchBase(query)
  activeCategory.value = query ? null : defaultCategory.value
}

// Get search results
const searchResults = computed<ISettingGroup[]>(() =>
  getSearchResults(activeCategory.value)
)

const tabValue = computed<string>(() =>
  inSearch.value ? 'Search Results' : activeCategory.value?.label ?? ''
)

// Don't allow null category to be set outside of search.
// In search mode, the active category can be null to show all search results.
watch(activeCategory, (_, oldValue) => {
  if (!tabValue.value) {
    activeCategory.value = oldValue
  }
  if (activeCategory.value?.key === 'credits') {
    void authActions.fetchBalance()
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

.settings-content {
  overflow-x: auto;
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

/* Hide the first group separator */
.settings-sidebar :deep(.p-listbox-option-group:nth-child(1)) {
  display: none;
}
</style>
