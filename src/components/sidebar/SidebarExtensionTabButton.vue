<template>
  <ContextMenu :model="getTabContextMenu(tab)" @close-auto-focus.prevent>
    <SidebarIcon
      :icon="tab.icon"
      :icon-badge="tab.iconBadge"
      :provenance-badge="isAgentTab(tab) ? 'AI' : undefined"
      :provenance-label="isAgentTab(tab) ? t('g.agentCreated') : undefined"
      :tooltip="tab.tooltip"
      :tooltip-suffix
      :label="tab.label || tab.title"
      :is-small
      :selected
      :data-testid="`${tab.id}-tab-button`"
      @click="emit('click')"
    />
  </ContextMenu>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ContextMenu from '@comfyorg/design-system/menu/ContextMenu'
import { useAgentSidebarTabs } from '@/composables/useAgentSidebarTabs'
import type { AgentSidebarTab } from '@/composables/useAgentSidebarTabs'

import SidebarIcon from './SidebarIcon.vue'

defineProps<{
  tab: AgentSidebarTab
  tooltipSuffix: string
  isSmall: boolean
  selected: boolean
}>()

const emit = defineEmits<{ (event: 'click'): void }>()
const { t } = useI18n()
const { getTabContextMenu, isAgentTab } = useAgentSidebarTabs()
</script>
