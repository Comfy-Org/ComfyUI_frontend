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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  useComfyManagerStore,
  useManagerProgressDialogStore
} from '@/stores/comfyManagerStore'

const progressDialogContent = useManagerProgressDialogStore()
const comfyManagerStore = useComfyManagerStore()
const activeTabIndex = computed({
  get: () => progressDialogContent.getActiveTabIndex(),
  set: (value: number) => progressDialogContent.setActiveTabIndex(value)
})
const { t } = useI18n()

const failedCount = computed(() => comfyManagerStore.failedTasksIds.length)

const queueSuffix = computed(() => {
  const queueLength = comfyManagerStore.managerQueue.queueLength
  if (queueLength === 0) {
    return ''
  }
  return ` (${queueLength})`
})
const failedSuffix = computed(() => {
  if (failedCount.value === 0) {
    return ''
  }
  return ` (${failedCount.value})`
})

const tabs = computed(() => [
  { label: t('manager.installationQueue') + queueSuffix.value },
  { label: t('manager.failed') + failedSuffix.value }
])
</script>
