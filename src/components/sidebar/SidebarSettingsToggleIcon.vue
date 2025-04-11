<template>
  <SidebarIcon
    icon="pi pi-cog"
    class="comfy-settings-btn"
    :tooltip="$t('g.settings')"
    @click="showSetting"
  />
</template>

<script setup lang="ts">
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import { useDialogStore } from '@/stores/dialogStore'

import SidebarIcon from './SidebarIcon.vue'

const dialogStore = useDialogStore()
const showSetting = () => {
  dialogStore.showDialog({
    key: 'global-settings',
    headerComponent: SettingDialogHeader,
    component: SettingDialogContent
  })
}
</script>
