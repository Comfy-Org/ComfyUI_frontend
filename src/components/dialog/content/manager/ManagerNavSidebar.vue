<template>
  <aside
    class="absolute translate-x-0 top-0 left-0 h-full w-80 shadow-md z-5 transition-transform duration-300 ease-in-out flex"
  >
    <ScrollPanel class="w-80 mt-7">
      <Listbox
        :model-value="selectedTab"
        :options="tabs"
        optionLabel="label"
        listStyle="max-height:unset"
        :pt="{
          root: { class: 'w-full border-0 bg-transparent' },
          list: { class: 'p-5' },
          option: { class: 'px-8 py-3 text-lg rounded-xl' },
          optionGroup: { class: 'p-0 text-left text-inherit' }
        }"
        @update:model-value="handleTabSelection"
      >
        <template #option="slotProps">
          <div class="text-left flex items-center">
            <i :class="['pi', slotProps.option.icon, 'mr-3']"></i>
            <span class="text-lg">{{ slotProps.option.label }}</span>
          </div>
        </template>
      </Listbox>
    </ScrollPanel>
    <ContentDivider orientation="vertical" />
  </aside>
</template>

<script setup lang="ts">
import Listbox from 'primevue/listbox'
import ScrollPanel from 'primevue/scrollpanel'

import ContentDivider from '@/components/common/ContentDivider.vue'
import type { TabItem } from '@/types/comfyManagerTypes'

defineProps<{
  tabs: TabItem[]
  selectedTab: TabItem
}>()

const emit = defineEmits<{
  'update:selectedTab': [value: TabItem]
}>()

const handleTabSelection = (tab: TabItem) => {
  emit('update:selectedTab', tab)
}
</script>
