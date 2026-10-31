import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

import { useAskAgentAboutIssues } from './useAskAgentAboutIssues'

const consent = vi.hoisted(() => ({
  withConsent: vi.fn<(trigger: string, onAccept: () => void) => Promise<void>>()
}))

vi.mock<unknown>(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => ({ useAgentConsent: () => ({ withConsent: consent.withConsent }) })
)

const CONTEXT: AgentErrorContext = {
  scope: 'card',
  count: 1,
  label: 'Missing media',
  severity: 'warning',
  problems: [{ category: 'missing_media', message: 'image missing' }]
}

describe('useAskAgentAboutIssues', () => {
  beforeEach(() => {
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      onAccept()
    })
  })

  it('reports availability from the agent panel gate', () => {
    const panel = useAgentPanelStore()
    const { canAskAgent } = useAskAgentAboutIssues()

    expect(canAskAgent.value).toBe(false)
    panel.enabled = true
    expect(canAskAgent.value).toBe(true)
  })

  it('opens the chat and attaches the context without sending', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const composer = useAgentComposerStore()
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(true)
    expect(panel.view).toEqual({ screen: 'chat' })
    expect(composer.errorContext).toMatchObject(CONTEXT)
  })

  it('does nothing when the agent is unavailable', async () => {
    const panel = useAgentPanelStore()
    const composer = useAgentComposerStore()
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(consent.withConsent).not.toHaveBeenCalled()
    expect(panel.isOpen).toBe(false)
    expect(composer.errorContext).toBeNull()
  })

  it('asks for consent like the Agent button before opening a closed panel', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const composer = useAgentComposerStore()
    let accept = () => {}
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      accept = onAccept
    })
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(consent.withConsent).toHaveBeenCalledWith(
      'button_click',
      expect.any(Function)
    )
    expect(panel.isOpen).toBe(false)
    expect(composer.errorContext).toBeNull()

    accept()

    expect(panel.isOpen).toBe(true)
    expect(composer.errorContext).toMatchObject(CONTEXT)
  })

  it('leaves the panel closed and the composer empty when consent is declined', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const composer = useAgentComposerStore()
    consent.withConsent.mockResolvedValue(undefined)
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(false)
    expect(composer.errorContext).toBeNull()
  })

  it('attaches directly when the panel is already open', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.open('topbar_button')
    const composer = useAgentComposerStore()
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(consent.withConsent).not.toHaveBeenCalled()
    expect(composer.errorContext).toMatchObject(CONTEXT)
  })

  it('drops the request if the agent turns off while the card is up', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const composer = useAgentComposerStore()
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      panel.enabled = false
      onAccept()
    })
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(false)
    expect(composer.errorContext).toBeNull()
  })

  it('keeps the workflow that was active at the click if the tab changes during consent', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const workflowStore = useWorkflowStore()
    Object.defineProperty(workflowStore, 'activeWorkflow', {
      configurable: true,
      value: { filename: 'broken.json' }
    })
    let accept = () => {}
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      accept = onAccept
    })
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)
    Object.defineProperty(workflowStore, 'activeWorkflow', {
      configurable: true,
      value: { filename: 'other.json' }
    })
    accept()

    expect(useAgentComposerStore().errorContext?.workflowName).toBe(
      'broken.json'
    )
  })

  it('offers one card for repeated clicks while consent is pending', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    let settle = () => {}
    consent.withConsent.mockImplementation(
      () => new Promise<void>((resolve) => (settle = resolve))
    )
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    const first = askAgentAboutIssues(CONTEXT)
    await askAgentAboutIssues(CONTEXT)
    settle()
    await first

    expect(consent.withConsent).toHaveBeenCalledTimes(1)
  })
})
