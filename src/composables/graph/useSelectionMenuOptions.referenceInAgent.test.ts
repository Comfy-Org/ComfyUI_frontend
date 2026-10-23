import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSelectionMenuOptions } from '@/composables/graph/useSelectionMenuOptions'
import type { MenuOption } from '@/composables/graph/menuOption'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  ASK_AGENT_TOOLBAR_SEEN_SETTING_ID,
  REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID
} from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { toNodeId } from '@/types/nodeId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { referenceNodesInAgent } from '@/components/graph/referenceNodesInAgent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/components/graph/referenceNodesInAgent'), () => ({
  referenceNodesInAgent: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      agent: {
        referenceInAgent: 'Reference in agent',
        new: 'NEW'
      },
      contextMenu: {
        Rename: 'Rename',
        Copy: 'Copy',
        Duplicate: 'Duplicate',
        Delete: 'Delete'
      },
      g: {
        frameNodes: 'Frame Nodes'
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function getReferenceInAgentOption(): MenuOption | null {
  let option: MenuOption | null = null
  const Wrapper = defineComponent({
    setup() {
      option = useSelectionMenuOptions().getReferenceInAgentOption()
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return option
}

describe('useSelectionMenuOptions.getReferenceInAgentOption', () => {
  it('is absent when the agent is unavailable', () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = false

    expect(getReferenceInAgentOption()).toBeNull()
  })

  it('references the selected nodes from the more menu', () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = true

    const option = getReferenceInAgentOption()
    expect(option).not.toBeNull()
    if (!option) return
    expect(option.label).toBe('Reference in agent')
    expect(option.icon).toBe('icon-[lucide--astroid]')
    option.action?.()
    expect(referenceNodesInAgent).toHaveBeenCalledExactlyOnceWith([node.id])
  })

  it('shows the NEW badge when the agent is on and the menu item is unseen', () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = true
    useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
      false

    const option = getReferenceInAgentOption()
    expect(option?.badgeLabel).toBe('NEW')
  })

  it('clears only the menu badge after click and keeps the setting', async () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(1)
    setCanvasSelection([node])
    useAgentPanelStore().enabled = true
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = false
    useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
      false

    const option = getReferenceInAgentOption()
    expect(option?.badgeLabel).toBe('NEW')
    option?.action?.()
    await Promise.resolve()

    expect(useSettingStore().get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)).toBe(
      true
    )
    expect(useSettingStore().get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)).toBe(false)
    expect(getReferenceInAgentOption()?.badgeLabel).toBeUndefined()
  })
})
