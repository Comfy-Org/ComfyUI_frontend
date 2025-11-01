<template>
  <SidebarIcon
    :label="$t('sideToolbar.labels.console')"
    :tooltip="$t('menu.toggleBottomPanel')"
    :selected="bottomPanelStore.activePanel == 'terminal'"
    @click="toggleConsole"
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

/**
 * Toggle console bottom panel and track UI button click.
 */
const toggleConsole = () => {
  useTelemetry()?.trackUiButtonClicked({ button_id: 'console' })
  bottomPanelStore.toggleBottomPanel()
}
</script>
