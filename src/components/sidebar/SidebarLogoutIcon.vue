<template>
  <SidebarIcon
    icon="pi pi-sign-out"
    :tooltip="$t('sideToolbar.logout')"
    @click="logout"
  />
</template>

<script setup lang="ts">
import SidebarIcon from './SidebarIcon.vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

const logout = () => {
  userStore.logout()
  window.location.reload()
}
</script>
