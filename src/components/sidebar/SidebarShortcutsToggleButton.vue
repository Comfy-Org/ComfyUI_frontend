<template>
  <SidebarIcon
    :tooltip="
      $t('shortcuts.keyboardShortcuts') +
      ' (' +
      formatKeySequence(command.keybinding!.combo.getKeySequences()) +
      ')'
    "
    :selected="isShortcutsPanelVisible"
    @click="toggleShortcutsPanel"
  >
    <template #icon>
      <i-lucide:keyboard />
    </template>
  </SidebarIcon>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCommandStore } from '@/stores/commandStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

import SidebarIcon from './SidebarIcon.vue'

const bottomPanelStore = useBottomPanelStore()
const command = useCommandStore().getCommand(
  'Workspace.ToggleBottomPanel.Shortcuts'
)

const isShortcutsPanelVisible = computed(
  () => bottomPanelStore.activePanel === 'shortcuts'
)

const toggleShortcutsPanel = () => {
  bottomPanelStore.togglePanel('shortcuts')
}

const formatKeySequence = (sequences: string[]): string => {
  return sequences
    .map((seq) => seq.replace(/Control/g, 'Ctrl').replace(/Shift/g, 'Shift'))
    .join(' + ')
}
</script>
