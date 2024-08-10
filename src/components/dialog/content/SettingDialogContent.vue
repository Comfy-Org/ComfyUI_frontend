<template>
  <div class="settings-container">
    <div class="settings-sidebar">
      <SettingSearchBox
        class="settings-search-box"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
      />
      <Listbox
        v-model="activeCategory"
        :options="categories"
        optionLabel="label"
        scrollHeight="100%"
        :disabled="inSearch"
        :pt="{ root: { class: 'border-none' } }"
      />
    </div>
    <Divider layout="vertical" />
    <div class="settings-content">
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
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Listbox from 'primevue/listbox'
import Tabs from 'primevue/tabs'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Divider from 'primevue/divider'
import { SettingTreeNode, useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import SettingGroup from './setting/SettingGroup.vue'
import SettingSearchBox from './setting/SettingSearchBox.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { flattenTree } from '@/utils/treeUtil'

interface ISettingGroup {
  label: string
  settings: SettingParams[]
}

const settingStore = useSettingStore()
const settingRoot = computed<SettingTreeNode>(() => settingStore.settingTree)
const categories = computed<SettingTreeNode[]>(
  () => settingRoot.value.children || []
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
/* Remove after we have tailwind setup */
.border-none {
  border: none !important;
}

.settings-tab-panels {
  padding-top: 0px !important;
}
</style>

<style scoped>
.settings-container {
  display: flex;
  height: 70vh;
  width: 60vw;
  max-width: 1000px;
  overflow: hidden;
  /* Prevents container from scrolling */
}

.settings-sidebar {
  width: 250px;
  flex-shrink: 0;
  /* Prevents sidebar from shrinking */
  overflow-y: auto;
  padding: 10px;
}

.settings-search-box {
  width: 100%;
  margin-bottom: 10px;
}

.settings-content {
  flex-grow: 1;
  overflow-y: auto;
  /* Allows vertical scrolling */
}

/* Ensure the Listbox takes full width of the sidebar */
.settings-sidebar :deep(.p-listbox) {
  width: 100%;
}

/* Optional: Style scrollbars for webkit browsers */
.settings-sidebar::-webkit-scrollbar,
.settings-content::-webkit-scrollbar {
  width: 1px;
}

.settings-sidebar::-webkit-scrollbar-thumb,
.settings-content::-webkit-scrollbar-thumb {
  background-color: transparent;
}
</style>
