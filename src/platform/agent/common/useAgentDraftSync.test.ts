import { describe, expect, it, vi } from 'vitest'

import type { DraftPatchEvent } from './agentProtocol'
import type { AgentDraftPorts } from './useAgentDraftSync'
import { useAgentDraftSync } from './useAgentDraftSync'

function makePorts(): AgentDraftPorts {
  return {
    applyToTab: vi.fn(),
    openInNewTab: vi.fn(),
    discardAgentResult: vi.fn()
  }
}

function patch(overrides: Partial<DraftPatchEvent> = {}): DraftPatchEvent {
  return {
    type: 'draft_patch',
    threadId: 't1',
    messageId: 'm1',
    workflowId: 'wf1',
    content: { nodes: ['ksampler'] },
    version: 8,
    baseVersion: 7,
    ...overrides
  }
}

describe('useAgentDraftSync', () => {
  it('applies a patch to the active tab and adopts the new version', () => {
    const ports = makePorts()
    const sync = useAgentDraftSync(ports)
    sync.registerWorkflow('wf1', 7)

    const outcome = sync.handlePatch(patch({ baseVersion: 7, version: 8 }))

    expect(outcome).toBe('applied')
    expect(ports.applyToTab).toHaveBeenCalledWith(
      'wf1',
      { nodes: ['ksampler'] },
      8
    )
    expect(sync.baseVersions.value.get('wf1')).toBe(8)
    expect(sync.pendingConflict.value).toBeNull()
  })

  it('surfaces a conflict when the user edited the graph mid-turn', () => {
    const ports = makePorts()
    const sync = useAgentDraftSync(ports)
    sync.registerWorkflow('wf1', 7)
    sync.setVersion('wf1', 8) // local autosave advanced the tab

    const outcome = sync.handlePatch(patch({ baseVersion: 7, version: 9 }))

    expect(outcome).toBe('conflict')
    expect(ports.applyToTab).not.toHaveBeenCalled()
    expect(sync.pendingConflict.value).toMatchObject({
      workflowId: 'wf1',
      version: 9
    })
  })

  it('ignores a stale patch', () => {
    const ports = makePorts()
    const sync = useAgentDraftSync(ports)
    sync.registerWorkflow('wf1', 8)

    const outcome = sync.handlePatch(patch({ baseVersion: 7, version: 8 }))

    expect(outcome).toBe('ignored')
    expect(ports.applyToTab).not.toHaveBeenCalled()
  })

  it('opens a new tab when the workflow has no open tab', () => {
    const ports = makePorts()
    const sync = useAgentDraftSync(ports)

    const outcome = sync.handlePatch(patch({ workflowId: 'wf-new' }))

    expect(outcome).toBe('opened-new-tab')
    expect(ports.openInNewTab).toHaveBeenCalledWith(
      'wf-new',
      { nodes: ['ksampler'] },
      8
    )
  })

  describe('resolveConflict', () => {
    function setupConflict() {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 7)
      sync.setVersion('wf1', 8)
      sync.handlePatch(patch({ baseVersion: 7, version: 9 }))
      return { ports, sync }
    }

    it('accept-agent applies the agent version and adopts it', () => {
      const { ports, sync } = setupConflict()
      sync.resolveConflict('accept-agent')

      expect(ports.applyToTab).toHaveBeenCalledWith(
        'wf1',
        { nodes: ['ksampler'] },
        9
      )
      expect(sync.baseVersions.value.get('wf1')).toBe(9)
      expect(sync.pendingConflict.value).toBeNull()
    })

    it('keep-mine discards the agent result and keeps the tab version', () => {
      const { ports, sync } = setupConflict()
      sync.resolveConflict('keep-mine')

      expect(ports.discardAgentResult).toHaveBeenCalledWith('wf1')
      expect(ports.applyToTab).not.toHaveBeenCalled()
      expect(sync.baseVersions.value.get('wf1')).toBe(8)
      expect(sync.pendingConflict.value).toBeNull()
    })

    it('new-tab opens the agent result without touching the active tab', () => {
      const { ports, sync } = setupConflict()
      sync.resolveConflict('new-tab')

      expect(ports.openInNewTab).toHaveBeenCalledWith(
        'wf1',
        { nodes: ['ksampler'] },
        9
      )
      expect(ports.applyToTab).not.toHaveBeenCalled()
      expect(sync.pendingConflict.value).toBeNull()
    })
  })
})
