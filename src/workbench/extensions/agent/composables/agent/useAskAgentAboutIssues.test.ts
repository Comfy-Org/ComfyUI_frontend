import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import type { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

import { useAskAgentAboutIssues } from './useAskAgentAboutIssues'

const consent = vi.hoisted(() => ({
  withConsent: vi.fn<ReturnType<typeof useAgentConsent>['withConsent']>()
}))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => ({
    useAgentConsent: () => ({
      accepted: computed(() => true),
      isChecking: computed(() => false),
      withConsent: consent.withConsent,
      resumeAcceptAfterReload: vi.fn(() => Promise.resolve())
    })
  })
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

  it('opens the chat and attaches the context without sending', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(true)
    expect(panel.view).toEqual({ screen: 'chat' })
    expect(panel.pendingErrorContext).toMatchObject(CONTEXT)
  })

  it('does nothing when the agent is unavailable', async () => {
    const panel = useAgentPanelStore()
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(consent.withConsent).not.toHaveBeenCalled()
    expect(panel.isOpen).toBe(false)
    expect(panel.pendingErrorContext).toBeNull()
  })

  it('asks for consent like the Agent button before opening a closed panel', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
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
    expect(panel.pendingErrorContext).toBeNull()

    accept()

    expect(panel.isOpen).toBe(true)
    expect(panel.pendingErrorContext).toMatchObject(CONTEXT)
  })

  it('leaves the panel closed and the composer empty when consent is declined', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    consent.withConsent.mockResolvedValue(undefined)
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(false)
    expect(panel.pendingErrorContext).toBeNull()
  })

  it('attaches directly when the panel is already open', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.open('topbar_button')
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(consent.withConsent).not.toHaveBeenCalled()
    expect(panel.pendingErrorContext).toMatchObject(CONTEXT)
  })

  it('drops the request if the agent turns off while the card is up', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      panel.enabled = false
      onAccept()
    })
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.isOpen).toBe(false)
    expect(panel.pendingErrorContext).toBeNull()
  })

  it('opens the panel without attaching when the tab changes during consent', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    const workflowStore = useWorkflowStore()
    Object.defineProperty(workflowStore, 'activeWorkflow', {
      configurable: true,
      value: createMockLoadedWorkflow({ path: 'workflows/broken.json' })
    })
    let accept = () => {}
    consent.withConsent.mockImplementation(async (_trigger, onAccept) => {
      accept = onAccept
    })
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)
    Object.defineProperty(workflowStore, 'activeWorkflow', {
      configurable: true,
      value: createMockLoadedWorkflow({ path: 'workflows/other.json' })
    })
    accept()

    expect(panel.isOpen).toBe(true)
    expect(panel.pendingErrorContext).toBeNull()
  })

  it('carries the clicked workflow path with the request', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    Object.defineProperty(useWorkflowStore(), 'activeWorkflow', {
      configurable: true,
      value: createMockLoadedWorkflow({ path: 'workflows/broken.json' })
    })
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    await askAgentAboutIssues(CONTEXT)

    expect(panel.pendingErrorContext?.workflowPath).toBe(
      'workflows/broken.json'
    )
  })

  it('never leaves later clicks dead when an earlier consent request stays pending', async () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    consent.withConsent.mockImplementationOnce(() => new Promise(() => {}))
    const { askAgentAboutIssues } = useAskAgentAboutIssues()

    void askAgentAboutIssues(CONTEXT)
    await askAgentAboutIssues(CONTEXT)

    expect(panel.pendingErrorContext).toMatchObject(CONTEXT)
  })
})
