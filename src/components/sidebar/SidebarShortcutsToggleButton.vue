<template>
  <SidebarIcon
    :tooltip="$t('shortcuts.keyboardShortcuts') + ' (Ctrl+Shift+K)'"
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

import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

import SidebarIcon from './SidebarIcon.vue'

const bottomPanelStore = useBottomPanelStore()

const isShortcutsPanelVisible = computed(
  () => bottomPanelStore.activePanel === 'shortcuts'
)

const toggleShortcutsPanel = () => {
  bottomPanelStore.togglePanel('shortcuts')
}
</script>
