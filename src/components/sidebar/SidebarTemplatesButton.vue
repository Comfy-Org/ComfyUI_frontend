<template>
  <SidebarIcon
    :icon="TemplateIcon"
    :tooltip="$t('sideToolbar.templates')"
    :label="$t('sideToolbar.labels.templates')"
    :is-small="isSmall"
    class="templates-tab-button"
    @click="openTemplates"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw } from 'vue'

import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'

import SidebarIcon from './SidebarIcon.vue'

// Import the custom template icon
const TemplateIcon = markRaw(
  defineAsyncComponent(() => import('virtual:icons/comfy/template'))
)

const settingStore = useSettingStore()
const commandStore = useCommandStore()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

const openTemplates = () => {
  void commandStore.execute('Comfy.BrowseTemplates')
}
</script>
