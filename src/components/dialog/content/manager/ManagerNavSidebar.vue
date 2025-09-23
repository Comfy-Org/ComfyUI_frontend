<template>
  <aside
    class="flex translate-x-0 max-w-[250px] w-3/12 z-5 transition-transform duration-300 ease-in-out"
  >
    <ScrollPanel class="flex-1">
      <Listbox
        v-model="selectedTab"
        :options="tabs"
        option-label="label"
        list-style="max-height:unset"
        class="w-full border-0 bg-transparent shadow-none"
        :pt="{
          list: { class: 'p-3 gap-2' },
          option: { class: 'px-4 py-2 text-lg rounded-lg' },
          optionGroup: { class: 'p-0 text-left text-inherit' }
        }"
      >
        <template #option="slotProps">
          <div class="text-left flex items-center">
            <i :class="['pi', slotProps.option.icon, 'text-sm mr-2']" />
            <span class="text-sm">{{ slotProps.option.label }}</span>
          </div>
        </template>
      </Listbox>
    </ScrollPanel>
    <ContentDivider orientation="vertical" :width="0.3" />
  </aside>
</template>

<script setup lang="ts">
import Listbox from 'primevue/listbox'
import ScrollPanel from 'primevue/scrollpanel'

import ContentDivider from '@/components/common/ContentDivider.vue'
import type { TabItem } from '@/types/comfyManagerTypes'

defineProps<{
  tabs: TabItem[]
}>()

const selectedTab = defineModel<TabItem>('selectedTab')
</script>
