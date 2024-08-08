<template>
  <div class="settings-container">
    <div class="settings-sidebar">
      <Listbox
        v-model="activeCategory"
        :options="categories"
        optionLabel="label"
        scrollHeight="100%"
        :pt="{ root: { class: 'border-none' } }"
      />
    </div>
    <Divider layout="vertical" />
    <div class="settings-content" v-if="activeCategory">
      <Tabs :value="activeCategory.label">
        <TabPanels>
          <TabPanel
            v-for="category in categories"
            :key="category.key"
            :value="category.label"
          >
            <SettingGroup
              v-for="group in sortedGroups(category)"
              :key="group.label"
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
import { flattenTree } from '@/utils/treeUtil'

const settingStore = useSettingStore()
const settingRoot = computed<SettingTreeNode>(() => settingStore.settingTree)
const categories = computed<SettingTreeNode[]>(
  () => settingRoot.value.children || []
)

const activeCategory = ref<SettingTreeNode | null>(null)

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
</script>

<style>
/* Remove after we have tailwind setup */
.border-none {
  border: none !important;
}
</style>

<style scoped>
.settings-container {
  display: flex;
  height: 80vh;
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
