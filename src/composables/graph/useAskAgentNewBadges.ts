import { computed } from 'vue'

import {
  ASK_AGENT_TOOLBAR_SEEN_SETTING_ID,
  REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID
} from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function useAskAgentNewBadges() {
  const settingStore = useSettingStore()
  const agentPanelStore = useAgentPanelStore()

  const showToolbarDot = computed(
    () =>
      agentPanelStore.enabled &&
      !settingStore.get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)
  )

  const showMenuBadge = computed(
    () =>
      agentPanelStore.enabled &&
      !settingStore.get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)
  )

  function markToolbarSeen() {
    if (settingStore.get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)) return
    void settingStore.set(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID, true)
  }

  function markMenuSeen() {
    if (settingStore.get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)) return
    void settingStore.set(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID, true)
  }

  return { showToolbarDot, showMenuBadge, markToolbarSeen, markMenuSeen }
}
