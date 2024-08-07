<template>
  <SideBarIcon
    icon="pi pi-cog"
    @click="showSetting"
    :tooltip="$t('sideToolBar.settings')"
  />
</template>

<script setup lang="ts">
import SideBarIcon from './SideBarIcon.vue'
import { useDialogStore } from '@/stores/dialogStore'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
const frontendVersion = window['__COMFYUI_FRONTEND_VERSION__']

const dialogStore = useDialogStore()
const showSetting = () => {
  dialogStore.showDialog({
    title: `Settings (v${frontendVersion})`,
    component: SettingDialogContent
  })
}
</script>
