<template>
  <SidebarIcon
    icon="pi pi-question-circle"
    class="comfy-help-center-btn"
    :label="$t('menu.help')"
    :tooltip="$t('sideToolbar.helpCenter')"
    :icon-badge="shouldShowRedDot ? '•' : ''"
    :is-small="isSmall"
    @click="toggleHelpCenter"
  />
</template>

<script setup lang="ts">
import { useHelpCenter } from '@/composables/useHelpCenter'

import SidebarIcon from './SidebarIcon.vue'

defineProps<{
  isSmall: boolean
}>()

const { shouldShowRedDot, toggleHelpCenter } = useHelpCenter()
</script>

<style scoped>
:deep(.p-badge) {
  background: #ff3b30;
  color: #ff3b30;
  min-width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 9999px;
  font-size: 0;
  margin-top: 4px;
  margin-right: 4px;
  border: none;
  outline: none;
  box-shadow: none;
}

:deep(.p-badge.p-badge-dot) {
  width: 8px !important;
}
</style>
