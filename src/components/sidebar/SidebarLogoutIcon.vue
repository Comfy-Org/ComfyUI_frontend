<template>
  <SidebarIcon
    icon="icon-[lucide--log-out] scale-90"
    :tooltip="tooltip"
    :label="$t('sideToolbar.logout')"
    @click="logout"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useUserStore } from '@/stores/userStore'

import SidebarIcon from './SidebarIcon.vue'

const { t } = useI18n()
const userStore = useUserStore()

const tooltip = computed(
  () => `${t('sideToolbar.logout')} (${userStore.currentUser?.username})`
)
const logout = async () => {
  await userStore.logout()
  window.location.reload()
}
</script>
