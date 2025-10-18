<template>
  <div class="settings-container">
    <ScrollPanel class="settings-sidebar w-48 shrink-0 p-2 2xl:w-64">
      <SearchBox
        v-model:model-value="searchQuery"
        class="settings-search-box mb-2 w-full"
        :placeholder="$t('g.searchSettings') + '...'"
        :debounce-time="128"
        autofocus
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
        class="w-full border-none"
      >
        <template #optiongroup>
          <Divider class="my-0" />
        </template>
      </Listbox>
    </ScrollPanel>
    <Divider layout="vertical" class="mx-1 hidden md:flex 2xl:mx-4" />
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
            <ColorPaletteMessage v-if="tabValue === 'Appearance'" />
          </template>
          <SettingsPanel :setting-groups="sortedGroups(category)" />
        </PanelTemplate>

        <Suspense v-for="panel in panels" :key="panel.node.key">
          <component :is="panel.component" />
          <template #fallback>
            <div>{{ $t('g.loadingPanel', { panel: panel.node.label }) }}</div>
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
import CurrentUserMessage from '@/components/dialog/content/setting/CurrentUserMessage.vue'
import PanelTemplate from '@/components/dialog/content/setting/PanelTemplate.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import ColorPaletteMessage from '@/platform/settings/components/ColorPaletteMessage.vue'
import SettingsPanel from '@/platform/settings/components/SettingsPanel.vue'
import { useSettingSearch } from '@/platform/settings/composables/useSettingSearch'
import { useSettingUI } from '@/platform/settings/composables/useSettingUI'
import type { SettingTreeNode } from '@/platform/settings/settingStore'
import type { ISettingGroup, SettingParams } from '@/platform/settings/types'
import { flattenTree } from '@/utils/treeUtil'

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
      settings: flattenTree<SettingParams>(group).sort((a, b) => {
        const sortOrderA = a.sortOrder ?? 0
        const sortOrderB = b.sortOrder ?? 0

        return sortOrderB - sortOrderA
      })
    }))
}

const handleSearch = (query: string) => {
  handleSearchBase(query.trim())
  activeCategory.value = query ? null : defaultCategory.value
}

// Get search results
const searchResults = computed<ISettingGroup[]>(() =>
  getSearchResults(activeCategory.value)
)

const tabValue = computed<string>(() =>
  inSearch.value ? 'Search Results' : (activeCategory.value?.label ?? '')
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
