<template>
  <SidebarIcon
    icon="icon-[comfy--template]"
    :tooltip="$t('sideToolbar.templates')"
    :label="$t('sideToolbar.labels.templates')"
    :is-small="isSmall"
    class="templates-tab-button"
    @click="openTemplates"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useSettingStore } from '@/platform/settings/settingStore'

import SidebarIcon from './SidebarIcon.vue'

const settingStore = useSettingStore()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

const openTemplates = () => {
  useWorkflowTemplateSelectorDialog().show('sidebar')
}
</script>
