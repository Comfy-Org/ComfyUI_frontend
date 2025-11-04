<template>
  <SidebarIcon
    :tooltip="$t('menu.toggleBottomPanel')"
    :selected="bottomPanelStore.activePanel == 'terminal'"
    @click="onClick"
  >
    <template #icon>
      <i-ph:terminal-bold />
    </template>
  </SidebarIcon>
</template>

<script setup lang="ts">
import { useTelemetry } from '@/platform/telemetry'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

import SidebarIcon from './SidebarIcon.vue'

const bottomPanelStore = useBottomPanelStore()
const onClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'sidebar_bottom_panel_console_toggled'
  })
  bottomPanelStore.toggleBottomPanel()
}
</script>
