import type { SourceAcquisition } from '@comfyorg/magic-patch-types'
import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import type {
  MagicPatchFailure,
  createMagicPatchClient
} from '../services/magicPatchClient'
import { createWorkflowSourcePreparation } from './workflowSourcePreparation'
import type { WorkflowSourceState } from './workflowSourcePreparation'
import type { UnresolvedWorkflowPack } from './unresolvedWorkflowPacks'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

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
  it.for([
    {
      failure: { code: 'request_failed', status: 401 },
      reason: 'source_authentication_required'
    },
    {
      failure: { code: 'invalid_response', status: 403 },
      reason: 'source_access_denied'
    },
    {
      failure: { code: 'request_failed', status: 429 },
      reason: 'source_rate_limited'
    },
    {
      failure: { code: 'unavailable', status: 503 },
      reason: 'source_service_unavailable'
    },
    { failure: { code: 'scope_changed' }, reason: 'source_scope_changed' },
    {
      failure: { code: 'transport_indeterminate' },
      reason: 'source_connection_failed'
    },
    {
      failure: { code: 'response_timeout' },
      reason: 'source_response_timeout'
    },
    {
      failure: { code: 'invalid_response' },
      reason: 'source_response_invalid'
    },
    {
      failure: { code: 'response_too_large' },
      reason: 'source_response_invalid'
    },
    { failure: { code: 'invalid_request' }, reason: 'source_request_invalid' },
    {
      failure: { code: 'request_failed', status: 400 },
      reason: 'source_request_failed'
    },
    {
      failure: {
        code: 'request_failed',
        status: 422,
        reason: 'pack_file_limit_exceeded'
      },
      reason: 'pack_file_limit_exceeded'
    }
  ] satisfies { failure: MagicPatchFailure; reason: string }[])(
    'preserves failure metadata and classifies $reason without converting',
    async ({ failure, reason }) => {
      const test = setup()
      test.client.prepareWorkflowSource.mockResolvedValue({
        ok: false,
        error: failure
      })
      await test.flow.start(pack)
      expect(test.publish).toHaveBeenLastCalledWith({
        phase: 'error',
        reason,
        failure
      })
      expect(test.ready).not.toHaveBeenCalled()
      expect(test.client.prepareWorkflowSource).toHaveBeenCalledOnce()
      expect(test.client.sourceStatus).not.toHaveBeenCalled()
    }
  )

  it('retains the same acquisition and deadline across a service failure and recovery', async () => {
    const test = setup()
    await test.flow.start(pack)
    const before = test.publish.mock.calls.at(-1)?.[0]
    if (before?.phase !== 'preparing') throw new Error('Expected preparation')
    const failure = { code: 'unavailable', status: 503 } as const
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: false,
      error: failure
    })
    await test.flow.refresh()
    expect(test.publish).toHaveBeenLastCalledWith({
      ...before,
      disconnected: true,
      reason: 'source_service_unavailable',
      failure
    })
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: true,
      value: { ...acquisition, state: 'acquiring', status_version: 2 }
    })
    await test.flow.refresh()
    expect(test.publish).toHaveBeenLastCalledWith({
      phase: 'preparing',
      acquisition: expect.objectContaining({ status_version: 2 }),
      deadline: before.deadline,
      disconnected: false
    })
    expect(test.client.prepareWorkflowSource).toHaveBeenCalledOnce()
    await test.flow.refresh()
    expect(test.ready).toHaveBeenCalledOnce()
  })

  it('sanitizes unexpected failures and ignores failures after disposal', async () => {
    const test = setup()
    test.client.prepareWorkflowSource.mockRejectedValueOnce(
      new Error('private-error-marker')
    )
    await test.flow.start(pack)
    expect(test.publish).toHaveBeenLastCalledWith({
      phase: 'error',
      reason: 'source_lookup_failed'
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'private-error-marker'
    )
    const disposed = setup()
    disposed.client.prepareWorkflowSource.mockImplementationOnce(async () => {
      disposed.flow.dispose()
      return { ok: false, error: { code: 'request_failed', status: 403 } }
    })
    await disposed.flow.start(pack)
    expect(disposed.publish).not.toHaveBeenCalled()
    expect(disposed.ready).not.toHaveBeenCalled()
  })

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
