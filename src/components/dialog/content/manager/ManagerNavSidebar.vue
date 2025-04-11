<template>
  <aside
    class="absolute translate-x-0 top-0 left-0 h-full w-80 shadow-md z-5 transition-transform duration-300 ease-in-out flex"
  >
    <ScrollPanel class="w-80 mt-7">
      <Listbox
        v-model="selectedTab"
        :options="tabs"
        option-label="label"
        list-style="max-height:unset"
        class="w-full border-0 bg-transparent shadow-none"
        :pt="{
          list: { class: 'p-5' },
          option: { class: 'px-8 py-3 text-lg rounded-xl' },
          optionGroup: { class: 'p-0 text-left text-inherit' }
        }"
      >
        <template #option="slotProps">
          <div class="text-left flex items-center">
            <i :class="['pi', slotProps.option.icon, 'mr-3']" />
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
}>()

const selectedTab = defineModel<TabItem>('selectedTab')
</script>
