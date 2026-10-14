import type { SourceAcquisition } from '@comfyorg/magic-patch-types'
import { describe, expect, it, vi } from 'vitest'

import type { createMagicPatchClient } from '../services/magicPatchClient'
import { createWorkflowSourcePreparation } from './workflowSourcePreparation'
import type { WorkflowSourceState } from './workflowSourcePreparation'
import type { UnresolvedWorkflowPack } from './unresolvedWorkflowPacks'

const pack: UnresolvedWorkflowPack = {
  key: 'power-2.0.0',
  name: 'Z-Image Power Nodes',
  cnrId: 'z-image-power-nodes',
  version: '2.0.0',
  nodeTypes: ['SaveImage //ZImagePowerNodes']
}
const acquisition: SourceAcquisition = {
  acquisition_id: 'a'.repeat(32),
  state: 'queued',
  status_version: 1,
  source_ref: null,
  reason: null,
  conversion_supported: false,
  message: 'Queued',
  progress: { stage: 'source_preparation', state: 'queued', message: 'Queued' }
}
const prepared: SourceAcquisition = {
  ...acquisition,
  state: 'ready',
  status_version: 3,
  conversion_supported: true,
  source_ref: 'b'.repeat(64),
  source: {
    pack_id: pack.cnrId!,
    revision_id: 'c'.repeat(64),
    registry_revision_id: 'c'.repeat(64),
    upstream_commit: 'd'.repeat(40),
    node_api_version: 1,
    nodes: pack.nodeTypes,
    admission: {},
    validation_prerequisites: {}
  }
}
function setup() {
  type Client = ReturnType<typeof createMagicPatchClient>
  const client = {
    prepareWorkflowSource: vi.fn<Client['prepareWorkflowSource']>(async () => ({
      ok: true,
      value: acquisition
    })),
    sourceStatus: vi.fn<Client['sourceStatus']>(async () => ({
      ok: true,
      value: prepared
    }))
  }
  const publish = vi.fn<(state: WorkflowSourceState) => void>()
  const ready = vi.fn(async () => true)
  let current = true
  return {
    client,
    publish,
    ready,
    flow: createWorkflowSourcePreparation(
      client,
      () => current,
      publish,
      ready
    ),
    invalidate: () => {
      current = false
    }
  }
}

describe('workflow source preparation', () => {
  it('starts only on confirmation, preserves exact workflow metadata, and hands off the prepared reference once', async () => {
    const test = setup()
    expect(test.client.prepareWorkflowSource).not.toHaveBeenCalled()
    await test.flow.start(pack)
    expect(test.client.prepareWorkflowSource).toHaveBeenCalledWith(
      { cnr_id: pack.cnrId, ver: '2.0.0', node_types: pack.nodeTypes },
      expect.any(AbortSignal)
    )
    expect(test.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'preparing', acquisition })
    )
    expect(test.ready).not.toHaveBeenCalled()
    await test.flow.refresh()
    await test.flow.refresh()
    expect(test.ready).toHaveBeenCalledExactlyOnceWith(
      prepared.source,
      prepared.source_ref
    )
    expect(test.publish).toHaveBeenLastCalledWith({ phase: 'resolved' })
  })

  it.for(['source_ready', 'unsupported', 'failed'] as const)(
    'keeps %s as a specific failure without conversion',
    async (state) => {
      const test = setup()
      test.client.prepareWorkflowSource.mockResolvedValue({
        ok: true,
        value: {
          ...acquisition,
          state,
          reason: 'pack_complexity_limit_exceeded'
        }
      })
      await test.flow.start(pack)
      expect(test.publish).toHaveBeenLastCalledWith({
        phase: 'error',
        reason: 'pack_complexity_limit_exceeded'
      })
      expect(test.ready).not.toHaveBeenCalled()
    }
  )

  it('does not guess a missing version or repository', async () => {
    const version = setup()
    await version.flow.start({ ...pack, version: undefined })
    expect(version.publish).toHaveBeenLastCalledWith({
      phase: 'error',
      reason: 'workflow_version_required'
    })
    expect(version.client.prepareWorkflowSource).not.toHaveBeenCalled()
    const identity = setup()
    await identity.flow.start({ ...pack, cnrId: undefined })
    expect(identity.publish).toHaveBeenLastCalledWith({
      phase: 'error',
      reason: 'workflow_source_identity_required'
    })
    expect(identity.client.prepareWorkflowSource).not.toHaveBeenCalled()
  })

  it('retains progress after disconnection and ignores older status versions', async () => {
    const test = setup()
    await test.flow.start(pack)
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: false,
      error: { code: 'transport_indeterminate' }
    })
    await test.flow.refresh()
    expect(test.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'preparing', disconnected: true })
    )
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: true,
      value: { ...prepared, status_version: 0 }
    })
    await test.flow.refresh()
    expect(test.ready).not.toHaveBeenCalled()
    await test.flow.refresh()
    expect(test.ready).toHaveBeenCalledOnce()
  })

  it('refuses ready sources missing requested nodes', async () => {
    const test = setup()
    if (!prepared.source) throw new Error('Missing prepared source fixture')
    test.client.prepareWorkflowSource.mockResolvedValue({
      ok: true,
      value: {
        ...prepared,
        source: { ...prepared.source, nodes: ['UnrelatedNode'] }
      }
    })
    await test.flow.start(pack)
    expect(test.publish).toHaveBeenLastCalledWith({
      phase: 'error',
      reason: 'source_binding_invalid'
    })
    expect(test.ready).not.toHaveBeenCalled()
  })

  it('ignores readiness after disposal or an account change', async () => {
    const test = setup()
    await test.flow.start(pack)
    test.client.sourceStatus.mockImplementationOnce(async () => {
      test.invalidate()
      test.flow.dispose()
      return { ok: true, value: prepared }
    })
    await test.flow.refresh()
    expect(test.ready).not.toHaveBeenCalled()
  })

  it('ends a stalled source preparation without converting', async () => {
    const test = setup()
    await test.flow.start(pack)
    vi.spyOn(performance, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER)
    await test.flow.refresh()
    expect(test.publish).toHaveBeenLastCalledWith({
      phase: 'error',
      reason: 'source_preparation_timeout'
    })
    expect(test.ready).not.toHaveBeenCalled()
  })
})
