<template>
  <div
    v-if="progressDialogContent.isExpanded"
    class="px-4 py-2 flex items-center"
  >
    <TabMenu
      v-model:activeIndex="activeTabIndex"
      :model="tabs"
      class="w-full border-none"
      :pt="{
        menu: { class: 'border-none' },
        menuitem: { class: 'font-medium' },
        action: { class: 'px-4 py-2' }
      }"
    />
  </div>
</template>

<script setup lang="ts">
import TabMenu from 'primevue/tabmenu'
import { ref } from 'vue'

import { useManagerProgressDialogStore } from '@/stores/comfyManagerStore'

const progressDialogContent = useManagerProgressDialogStore()
const activeTabIndex = ref(0)

const tabs = [{ label: 'Installation Queue' }, { label: 'Failed (0)' }]
</script>
