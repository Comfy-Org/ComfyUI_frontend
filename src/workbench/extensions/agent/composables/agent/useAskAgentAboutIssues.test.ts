import { describe, expect, it } from 'vitest'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import type { AgentErrorContext } from '../../types/agentErrorContext'
import { useAskAgentAboutIssues } from './useAskAgentAboutIssues'

const CONTEXT: AgentErrorContext = {
  scope: 'card',
  count: 1,
  label: 'Missing media',
  severity: 'warning',
  problems: [{ category: 'missing_media', message: 'image missing' }]
}

describe('useAskAgentAboutIssues', () => {
  it('reports availability from the agent panel gate', () => {
    const panel = useAgentPanelStore()
    const { canAskAgent } = useAskAgentAboutIssues()

    expect(canAskAgent.value).toBe(false)
    panel.enabled = true
    expect(canAskAgent.value).toBe(true)
  })

  it('opens the chat and attaches the context without sending', () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const composer = useAgentComposerStore()
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(true)
    expect(panel.view).toEqual({ screen: 'chat' })
    expect(composer.errorContext).toEqual(CONTEXT)
  })

  it('does nothing when the agent is unavailable', () => {
    const panel = useAgentPanelStore()
    const composer = useAgentComposerStore()
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(false)
    expect(composer.errorContext).toBeNull()
  })
})
