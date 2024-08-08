<template>
  <div class="settings-container">
    <div class="settings-sidebar">
      <Listbox
        v-model="activeCategory"
        :options="categories"
        optionLabel="label"
      />
    </div>
    <div class="settings-content" v-if="activeCategory">
      <Tabs :value="activeCategory.label">
        <TabPanels>
          <TabPanel
            v-for="category in categories"
            :key="category.key"
            :value="category.label"
          >
            <SettingGroup
              v-for="group in category.children"
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
import { ref, computed, onMounted } from 'vue'
import Listbox from 'primevue/listbox'
import Tabs from 'primevue/tabs'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
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

onMounted(() => {
  activeCategory.value = categories.value[0]
  console.log('activeCategory', activeCategory.value)
})
</script>
