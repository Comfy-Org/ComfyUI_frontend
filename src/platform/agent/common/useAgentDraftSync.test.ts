import { describe, expect, it, vi } from 'vitest'

import type { DraftPatchEvent } from './agentProtocol'
import { parseAgentEvent } from './agentProtocol'
import type { AgentDraftPorts } from './useAgentDraftSync'
import { useAgentDraftSync } from './useAgentDraftSync'

const SNAPSHOT = { content: { nodes: ['from-snapshot'] }, version: 12 }

function makePorts(): AgentDraftPorts {
  return {
    applyToTab: vi.fn(),
    openInNewTab: vi.fn(),
    discardAgentResult: vi.fn(),
    fetchSnapshot: vi.fn().mockResolvedValue(SNAPSHOT)
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

  describe('forgetWorkflow', () => {
    it('clears a pending conflict targeting the closed workflow', () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 7)
      sync.setVersion('wf1', 8)
      sync.handlePatch(patch({ baseVersion: 7, version: 9 }))
      expect(sync.pendingConflict.value).not.toBeNull()

      sync.forgetWorkflow('wf1')

      expect(sync.pendingConflict.value).toBeNull()
    })

    it('leaves a pending conflict for a different workflow intact', () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 7)
      sync.setVersion('wf1', 8)
      sync.handlePatch(patch({ baseVersion: 7, version: 9 }))

      sync.forgetWorkflow('wf2')

      expect(sync.pendingConflict.value).toMatchObject({ workflowId: 'wf1' })
    })
  })

  describe('wire envelope -> reconciler', () => {
    function wirePatch(version: number, baseVersion: number) {
      const event = parseAgentEvent({
        type: 'draft_patch',
        data: {
          thread_id: 't1',
          message_id: 'm1',
          workflow_id: 'wf1',
          content: { nodes: ['ksampler'] },
          version,
          base_version: baseVersion
        }
      })
      if (event?.type !== 'draft_patch') {
        throw new Error('expected a draft_patch event')
      }
      return event
    }

    it('applies when base_version matches the tab version', () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 7)

      const outcome = sync.handlePatch(wirePatch(8, 7))

      expect(outcome).toBe('applied')
      expect(ports.applyToTab).toHaveBeenCalledWith(
        'wf1',
        { nodes: ['ksampler'] },
        8
      )
    })

    it('conflicts when base_version differs from the tab version', () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 7)
      sync.setVersion('wf1', 8)

      const outcome = sync.handlePatch(wirePatch(9, 7))

      expect(outcome).toBe('conflict')
      expect(ports.applyToTab).not.toHaveBeenCalled()
      expect(sync.pendingConflict.value).toMatchObject({
        workflowId: 'wf1',
        baseVersion: 7,
        version: 9
      })
    })
  })

  describe('resync (reconnect / cold start)', () => {
    it('seeds the tab from the snapshot when none is registered yet', async () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)

      const outcome = await sync.resync('wf1')

      expect(outcome).toBe('restored')
      expect(ports.fetchSnapshot).toHaveBeenCalledWith('wf1')
      expect(ports.applyToTab).toHaveBeenCalledWith(
        'wf1',
        SNAPSHOT.content,
        SNAPSHOT.version
      )
      expect(sync.baseVersions.value.get('wf1')).toBe(SNAPSHOT.version)
    })

    it('restores a newer snapshot over a stale local version', async () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 5)

      const outcome = await sync.resync('wf1')

      expect(outcome).toBe('restored')
      expect(sync.baseVersions.value.get('wf1')).toBe(SNAPSHOT.version)
    })

    it('leaves the tab untouched when the snapshot is not newer (watermark)', async () => {
      const ports = makePorts()
      vi.mocked(ports.fetchSnapshot).mockResolvedValue({
        content: { nodes: ['old'] },
        version: 8
      })
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 8)

      const outcome = await sync.resync('wf1')

      expect(outcome).toBe('up-to-date')
      expect(ports.applyToTab).not.toHaveBeenCalled()
      expect(sync.baseVersions.value.get('wf1')).toBe(8)
    })

    it('shares one in-flight request across concurrent resyncs', async () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)

      const [a, b] = await Promise.all([sync.resync('wf1'), sync.resync('wf1')])

      expect(a).toBe('restored')
      expect(b).toBe('restored')
      expect(ports.fetchSnapshot).toHaveBeenCalledTimes(1)
    })

    it('clears an open merge dialog when it restores a newer snapshot', async () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 5)
      sync.setVersion('wf1', 6)
      sync.handlePatch(patch({ baseVersion: 4, version: 7 }))
      expect(sync.pendingConflict.value).not.toBeNull()

      const outcome = await sync.resync('wf1')

      expect(outcome).toBe('restored')
      expect(sync.pendingConflict.value).toBeNull()
    })

    it('does not resurrect tracking for a tab closed mid-fetch', async () => {
      const ports = makePorts()
      let resolveFetch!: (snapshot: typeof SNAPSHOT) => void
      vi.mocked(ports.fetchSnapshot).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 5)

      const pending = sync.resync('wf1')
      sync.forgetWorkflow('wf1')
      resolveFetch(SNAPSHOT)

      expect(await pending).toBe('up-to-date')
      expect(ports.applyToTab).not.toHaveBeenCalled()
      expect(sync.baseVersions.value.has('wf1')).toBe(false)
    })
  })

  describe('gap detection', () => {
    it('refetches the snapshot when the agent advanced past the tab', async () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 5)

      const outcome = sync.handlePatch(patch({ baseVersion: 7, version: 8 }))

      expect(outcome).toBe('gap')
      expect(ports.applyToTab).not.toHaveBeenCalled()
      await sync.pendingResync('wf1')
      expect(ports.fetchSnapshot).toHaveBeenCalledWith('wf1')
      expect(ports.applyToTab).toHaveBeenCalledWith(
        'wf1',
        SNAPSHOT.content,
        SNAPSHOT.version
      )
      expect(sync.baseVersions.value.get('wf1')).toBe(SNAPSHOT.version)
      expect(sync.pendingConflict.value).toBeNull()
    })
  })

  describe('handleVersionTip (trailing lost patch)', () => {
    it('resyncs when the tip outruns the local watermark', async () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 5)

      const outcome = sync.handleVersionTip('wf1', 9)

      expect(outcome).toBe('resyncing')
      await sync.pendingResync('wf1')
      expect(ports.fetchSnapshot).toHaveBeenCalledWith('wf1')
      expect(sync.baseVersions.value.get('wf1')).toBe(SNAPSHOT.version)
    })

    it('does nothing when the tip is not newer', () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 9)

      expect(sync.handleVersionTip('wf1', 9)).toBe('up-to-date')
      expect(ports.fetchSnapshot).not.toHaveBeenCalled()
    })

    it('ignores a tip for a workflow with no open tab', () => {
      const ports = makePorts()
      const sync = useAgentDraftSync(ports)

      expect(sync.handleVersionTip('wf-unknown', 9)).toBe('ignored')
      expect(ports.fetchSnapshot).not.toHaveBeenCalled()
    })

    it('preserves local state when a self-heal fetch fails', async () => {
      const ports = makePorts()
      const boom = new Error('network down')
      vi.mocked(ports.fetchSnapshot).mockRejectedValue(boom)
      const sync = useAgentDraftSync(ports)
      sync.registerWorkflow('wf1', 5)

      expect(sync.handleVersionTip('wf1', 9)).toBe('resyncing')
      await expect(sync.pendingResync('wf1')).rejects.toBe(boom)

      expect(ports.applyToTab).not.toHaveBeenCalled()
      expect(sync.baseVersions.value.get('wf1')).toBe(5)
    })
  })
})
