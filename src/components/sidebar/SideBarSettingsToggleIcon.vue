<template>
  <SideBarIcon
    icon="pi pi-cog"
    @click="showSetting"
    :tooltip="$t('settings')"
  />
</template>

<script setup lang="ts">
import SideBarIcon from './SideBarIcon.vue'
import { useDialogStore } from '@/stores/dialogStore'
import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'

const dialogStore = useDialogStore()
const showSetting = () => {
  dialogStore.showDialog({
    headerComponent: SettingDialogHeader,
    component: SettingDialogContent
  })
}
</script>
