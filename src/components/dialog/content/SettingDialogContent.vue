<template>
  <div class="settings-container">
    <ScrollPanel class="settings-sidebar flex-shrink-0 p-2 w-64">
      <SearchBox
        class="settings-search-box w-full mb-2"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('searchSettings') + '...'"
      />
      <Listbox
        v-model="activeCategory"
        :options="categories"
        optionLabel="label"
        scrollHeight="100%"
        :disabled="inSearch"
        class="border-none w-full"
      />
    </ScrollPanel>
    <Divider layout="vertical" />
    <ScrollPanel class="settings-content flex-grow">
      <Tabs :value="tabValue">
        <TabPanels class="settings-tab-panels">
          <TabPanel key="search-results" value="Search Results">
            <div v-if="searchResults.length > 0">
              <SettingGroup
                v-for="(group, i) in searchResults"
                :key="group.label"
                :divider="i !== 0"
                :group="group"
              />
            </div>
            <NoResultsPlaceholder
              v-else
              icon="pi pi-search"
              :title="$t('noResultsFound')"
              :message="$t('searchFailedMessage')"
            />
          </TabPanel>
          <TabPanel
            v-for="category in categories"
            :key="category.key"
            :value="category.label"
          >
            <SettingGroup
              v-for="(group, i) in sortedGroups(category)"
              :key="group.label"
              :divider="i !== 0"
              :group="{
                label: group.label,
                settings: flattenTree<SettingParams>(group)
              }"
            />
          </TabPanel>
          <TabPanel key="about" value="About">
            <AboutPanel />
          </TabPanel>
          <TabPanel key="keybinding" value="Keybinding">
            <Suspense>
              <KeybindingPanel />
              <template #fallback>
                <div>Loading keybinding panel...</div>
              </template>
            </Suspense>
          </TabPanel>
          <TabPanel key="extension" value="Extension">
            <Suspense>
              <ExtensionPanel />
              <template #fallback>
                <div>Loading extension panel...</div>
              </template>
            </Suspense>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue'
import Listbox from 'primevue/listbox'
import Tabs from 'primevue/tabs'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Divider from 'primevue/divider'
import ScrollPanel from 'primevue/scrollpanel'
import { SettingTreeNode, useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import SettingGroup from './setting/SettingGroup.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { flattenTree } from '@/utils/treeUtil'
import AboutPanel from './setting/AboutPanel.vue'

const KeybindingPanel = defineAsyncComponent(
  () => import('./setting/KeybindingPanel.vue')
)
const ExtensionPanel = defineAsyncComponent(
  () => import('./setting/ExtensionPanel.vue')
)

interface ISettingGroup {
  label: string
  settings: SettingParams[]
}

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

const extensionPanelNodeList = computed<SettingTreeNode[]>(() => {
  const settingStore = useSettingStore()
  const showExtensionPanel = settingStore.get('Comfy.Settings.ExtensionPanel')
  return showExtensionPanel ? [extensionPanelNode] : []
})

const settingStore = useSettingStore()
const settingRoot = computed<SettingTreeNode>(() => settingStore.settingTree)
const categories = computed<SettingTreeNode[]>(() => [
  ...(settingRoot.value.children || []),
  keybindingPanelNode,
  ...extensionPanelNodeList.value,
  aboutPanelNode
])
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

const sortedGroups = (category: SettingTreeNode) => {
  return [...(category.children || [])].sort((a, b) =>
    a.label.localeCompare(b.label)
  )
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
