<template>
  <SidebarIcon
    :tooltip="$t('menu.toggleBottomPanel')"
    :selected="bottomPanelStore.activePanel == 'terminal'"
    @click="bottomPanelStore.toggleBottomPanel"
  >
    <template #icon>
      <i-ph:terminal-bold />
    </template>
  </SidebarIcon>
</template>

<script setup lang="ts">
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

import SidebarIcon from './SidebarIcon.vue'

const bottomPanelStore = useBottomPanelStore()
</script>
