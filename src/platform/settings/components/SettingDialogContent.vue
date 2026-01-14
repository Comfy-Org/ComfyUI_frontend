<template>
  <div class="flex h-[80vh] w-full overflow-hidden">
    <ScrollPanel class="w-48 shrink-0 p-2 2xl:w-64">
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
        class="w-full border-none bg-transparent"
      >
        <template #optiongroup="{ option }">
          <!-- <Divider v-if="option.key !== 'workspace'" class="my-2" /> -->
          <h3 class="text-xs font-semibold uppercase text-muted m-0 pt-6 pb-2">
            {{ option.label }}
          </h3>
        </template>
        <template #option="{ option }">
          <WorkspaceSidebarItem v-if="option.key === 'workspace'" />
          <span v-else>{{ option.translatedLabel }}</span>
        </template>
      </Listbox>
    </ScrollPanel>
    <Divider layout="vertical" class="mx-1 hidden md:flex 2xl:mx-4" />
    <Divider layout="horizontal" class="flex md:hidden" />
    <Tabs :value="tabValue" :lazy="true" class="h-full flex-1 overflow-x-auto">
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
          <component :is="panel.component" v-bind="panel.props" />
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
import WorkspaceSidebarItem from '@/components/dialog/content/setting/WorkspaceSidebarItem.vue'
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
    | 'subscription'
    | 'workspace'
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

// Get max sortOrder from settings in a group
const getGroupSortOrder = (group: SettingTreeNode): number =>
  Math.max(0, ...flattenTree<SettingParams>(group).map((s) => s.sortOrder ?? 0))

// Sort groups for a category
const sortedGroups = (category: SettingTreeNode): ISettingGroup[] => {
  return [...(category.children ?? [])]
    .sort((a, b) => {
      const orderDiff = getGroupSortOrder(b) - getGroupSortOrder(a)
      return orderDiff !== 0 ? orderDiff : a.label.localeCompare(b.label)
    })
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
