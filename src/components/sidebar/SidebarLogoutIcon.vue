<template>
  <SidebarIcon icon="pi pi-sign-out" :tooltip="tooltip" @click="logout" />
</template>

<script setup lang="ts">
import SidebarIcon from './SidebarIcon.vue'
import { useUserStore } from '@/stores/userStore'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const userStore = useUserStore()

const tooltip = computed(
  () => `${t('sideToolbar.logout')} (${userStore.currentUser?.username})`
)
const logout = () => {
  userStore.logout()
  window.location.reload()
}
</script>
