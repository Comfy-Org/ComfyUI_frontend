<template>
  <div
    v-if="progressDialogContent.isExpanded"
    class="flex items-center px-4 py-2"
  >
    <TabMenu
      v-model:active-index="activeTabIndex"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/workbench/extensions/manager/stores/comfyManagerStore'

const progressDialogContent = useManagerProgressDialogStore()
const comfyManagerStore = useComfyManagerStore()
const activeTabIndex = computed({
  get: () => progressDialogContent.getActiveTabIndex(),
  set: (value) => progressDialogContent.setActiveTabIndex(value)
})
const { t } = useI18n()
const tabs = computed(() => [
  { label: t('manager.installationQueue') },
  {
    label: t('manager.failed', {
      count: comfyManagerStore.failedTasksIds.length
    })
  }
])
</script>
