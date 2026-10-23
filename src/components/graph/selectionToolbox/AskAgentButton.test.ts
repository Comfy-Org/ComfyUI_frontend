import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { referenceNodesInAgent } from '@/components/graph/referenceNodesInAgent'
import AskAgentButton from '@/components/graph/selectionToolbox/AskAgentButton.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  ASK_AGENT_TOOLBAR_SEEN_SETTING_ID,
  REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID
} from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/components/graph/referenceNodesInAgent'), () => ({
  referenceNodesInAgent: vi.fn()
}))

vi.mock<unknown>(import('@/composables/graph/useSelectionState'), () => ({
  useSelectionState: vi.fn(() => ({
    selectedNodes: { value: [] }
  }))
}))

describe('AskAgentButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        agent: {
          askAgent: 'Ask agent'
        }
      }
    }
  })

  const renderComponent = () =>
    render(AskAgentButton, {
      global: {
        plugins: [i18n]
      }
    })

  const selectNode = () => {
    const node = new LGraphNode('KSampler')
    node.id = toNodeId(5)
    vi.mocked(useSelectionState).mockReturnValue(
      fromPartial<ReturnType<typeof useSelectionState>>({
        selectedNodes: { value: [node] }
      })
    )
    return node
  }

  it('references the selected nodes without sending', async () => {
    const node = selectNode()
    useAgentPanelStore().enabled = true
    renderComponent()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(referenceNodesInAgent).toHaveBeenCalledExactlyOnceWith([node.id])
  })

  it('shows the new dot when the agent is on and the toolbar is unseen', () => {
    selectNode()
    useAgentPanelStore().enabled = true
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = false
    renderComponent()

    expect(screen.getByTestId('ask-agent-new-dot')).toBeVisible()
  })

  it('hides the new dot when the agent is off', () => {
    selectNode()
    useAgentPanelStore().enabled = false
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = false
    renderComponent()

    expect(screen.queryByTestId('ask-agent-new-dot')).not.toBeInTheDocument()
  })

  it('clears only the toolbar dot after click and keeps the setting', async () => {
    selectNode()
    useAgentPanelStore().enabled = true
    useSettingStore().settingValues[ASK_AGENT_TOOLBAR_SEEN_SETTING_ID] = false
    useSettingStore().settingValues[REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID] =
      false
    const { unmount } = renderComponent()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(screen.queryByTestId('ask-agent-new-dot')).not.toBeInTheDocument()
    expect(useSettingStore().get(ASK_AGENT_TOOLBAR_SEEN_SETTING_ID)).toBe(true)
    expect(useSettingStore().get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)).toBe(
      false
    )

    unmount()
    renderComponent()

    expect(screen.queryByTestId('ask-agent-new-dot')).not.toBeInTheDocument()
    expect(useSettingStore().get(REFERENCE_IN_AGENT_MENU_SEEN_SETTING_ID)).toBe(
      false
    )
  })
})
