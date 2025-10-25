<template>
  <SidebarIcon
    :label="$t('shortcuts.shortcuts')"
    :tooltip="tooltipText"
    :selected="isShortcutsPanelVisible"
    @click="toggleShortcutsPanel"
  >
    <template #icon>
      <i class="icon-[lucide--keyboard]" />
    </template>
  </SidebarIcon>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

import SidebarIcon from './SidebarIcon.vue'

const { t } = useI18n()
const bottomPanelStore = useBottomPanelStore()
const commandStore = useCommandStore()
const command = commandStore.getCommand('Workspace.ToggleBottomPanel.Shortcuts')
const { formatKeySequence } = commandStore

const isShortcutsPanelVisible = computed(
  () => bottomPanelStore.activePanel === 'shortcuts'
)

const tooltipText = computed(
  () => `${t('shortcuts.keyboardShortcuts')} (${formatKeySequence(command)})`
)

const toggleShortcutsPanel = () => {
  bottomPanelStore.togglePanel('shortcuts')
}
</script>
