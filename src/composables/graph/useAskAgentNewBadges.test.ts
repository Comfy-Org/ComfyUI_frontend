import { beforeEach, describe, expect, it } from 'vitest'

import { useAskAgentNewBadges } from '@/composables/graph/useAskAgentNewBadges'
import {
  ASK_AGENT_TOOLBAR_SEEN_SETTING_ID,
  REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID
} from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

describe('useAskAgentNewBadges', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = false
    useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
      false
  })

  it('shows both badges when the agent is on and neither entry is seen', () => {
    const { showToolbarDot, showMenuBadge } = useAskAgentNewBadges()

    expect(showToolbarDot.value).toBe(true)
    expect(showMenuBadge.value).toBe(true)
  })

  it('hides both badges when the agent is off', () => {
    useAgentPanelStore().enabled = false
    const { showToolbarDot, showMenuBadge } = useAskAgentNewBadges()

    expect(showToolbarDot.value).toBe(false)
    expect(showMenuBadge.value).toBe(false)
  })

  it('clears only the toolbar badge when the toolbar is marked seen', async () => {
    const { showToolbarDot, showMenuBadge, markToolbarSeen } =
      useAskAgentNewBadges()

    markToolbarSeen()
    await Promise.resolve()

    expect(showToolbarDot.value).toBe(false)
    expect(showMenuBadge.value).toBe(true)
    expect(useSettingStore().get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)).toBe(true)
    expect(useSettingStore().get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)).toBe(
      false
    )
  })

  it('clears only the menu badge when the menu is marked seen', async () => {
    const { showToolbarDot, showMenuBadge, markMenuSeen } =
      useAskAgentNewBadges()

    markMenuSeen()
    await Promise.resolve()

    expect(showToolbarDot.value).toBe(true)
    expect(showMenuBadge.value).toBe(false)
    expect(useSettingStore().get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)).toBe(false)
    expect(useSettingStore().get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)).toBe(
      true
    )
  })

  it('keeps each badge hidden after its seen setting is already true', () => {
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = true
    useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
      true
    const { showToolbarDot, showMenuBadge } = useAskAgentNewBadges()

    expect(showToolbarDot.value).toBe(false)
    expect(showMenuBadge.value).toBe(false)
  })
})
