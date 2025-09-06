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

import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'

import SidebarIcon from './SidebarIcon.vue'

const settingStore = useSettingStore()
const commandStore = useCommandStore()

const isSmall = computed(
  () => settingStore.get('Comfy.Sidebar.Size') === 'small'
)

const openTemplates = () => {
  void commandStore.execute('Comfy.BrowseTemplates')
}
</script>
