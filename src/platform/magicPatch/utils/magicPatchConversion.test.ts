import { describe, expect, it, vi } from 'vitest'
import type {
  RequestStatus,
  SourceAcquisition
} from '@comfyorg/magic-patch-types'
import type { createMagicPatchClient } from '../services/magicPatchClient'
import { createMagicPatchConversion } from './magicPatchConversion'
import type { ConversionState } from './magicPatchConversion'

const request: RequestStatus = {
  id: 'request',
  operation_id: 'operation',
  state: 'waiting_conversion',
  operation_status: 'queued',
  status_version: 1
}
function setup() {
  let state: ConversionState = { phase: 'idle' }
  let current = true
  type Client = ReturnType<typeof createMagicPatchClient>
  const client = {
    prepareSource: vi.fn<Client['prepareSource']>(),
    sourceStatus: vi.fn<Client['sourceStatus']>(),
    eligibility: vi.fn<Client['eligibility']>(),
    source: vi.fn<Client['source']>(async () => ({
      ok: true as const,
      value: {
        source_ref: 'a'.repeat(64),
        entry_point: 'pack_pin' as const,
        pack_id: 'pack',
        revision_id: 'b'.repeat(64)
      }
    })),
    submit: vi.fn<Client['submit']>(async () => ({
      ok: true as const,
      value: request
    })),
    status: vi.fn<Client['status']>(async () => ({
      ok: true as const,
      value: request
    })),
    cancel: vi.fn<Client['cancel']>(async () => ({
      ok: true as const,
      value: {
        request: { ...request, state: 'withdrawn' as const, status_version: 2 },
        worker_cancellation: 'requested' as const
      }
    }))
  }
  return {
    client,
    flow: createMagicPatchConversion(
      client,
      (next) => {
        state = next
      },
      () => current
    ),
    state: () => state,
    changeScope: () => {
      current = false
    }
  }
}
const selector = { pack_id: 'pack', revision_id: 'b'.repeat(64) }
const preparation = (
  state: SourceAcquisition['state'] = 'queued',
  statusVersion = 1
): SourceAcquisition => ({
  acquisition_id: 'c'.repeat(32),
  state,
  status_version: statusVersion,
  source_ref: state === 'ready' ? 'a'.repeat(64) : null,
  reason: null,
  conversion_supported: state === 'ready',
  message: 'Preparing original source',
  progress: {
    stage: 'source_preparation',
    state,
    message: 'Preparing original source'
  },
  ...(state === 'ready'
    ? {
        source: {
          ...selector,
          registry_revision_id: selector.revision_id,
          upstream_commit: 'd'.repeat(40),
          node_api_version: 1,
          nodes: ['TestNode'],
          admission: {},
          validation_prerequisites: {}
        }
      }
    : {})
})
describe('pack conversion journey', () => {
  it('refuses a minted source that differs from the confirmed workflow preparation', async () => {
    const test = setup()
    await test.flow.start(selector, [], 'f'.repeat(64))
    expect(test.state()).toEqual({
      phase: 'error',
      reason: 'source_binding_invalid'
    })
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('ends a stalled source preparation without submitting a conversion', async () => {
    const test = setup()
    test.client.source.mockResolvedValueOnce({
      ok: false,
      error: { code: 'request_failed', reason: 'source_preparation_required' }
    })
    test.client.prepareSource.mockResolvedValue({
      ok: true,
      value: preparation()
    })
    await test.flow.start(selector)
    const previous = test.state()
    if (previous.phase !== 'preparing')
      throw new Error('Source preparation fixture not started')
    vi.spyOn(performance, 'now').mockReturnValue(previous.deadline + 1)
    await test.flow.refresh()
    expect(test.state()).toEqual({
      phase: 'error',
      reason: 'source_preparation_timeout'
    })
    expect(test.client.submit).not.toHaveBeenCalled()
    expect(test.client.sourceStatus).not.toHaveBeenCalled()
  })
  it('does not mint or submit a prepared source after its workspace changes', async () => {
    const test = setup()
    test.client.source.mockResolvedValueOnce({
      ok: false,
      error: { code: 'request_failed', reason: 'source_preparation_required' }
    })
    test.client.prepareSource.mockResolvedValue({
      ok: true,
      value: preparation()
    })
    await test.flow.start(selector)
    test.client.sourceStatus.mockImplementationOnce(async () => {
      test.changeScope()
      return { ok: true, value: preparation('ready', 3) }
    })
    await test.flow.refresh()
    expect(test.client.source).toHaveBeenCalledOnce()
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('prepares the original only after consent, displays its actual progress, then submits once when ready', async () => {
    const test = setup()
    test.client.source.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'request_failed',
        status: 422,
        reason: 'source_preparation_required'
      }
    })
    test.client.prepareSource.mockResolvedValue({
      ok: true,
      value: preparation()
    })
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: true,
      value: preparation('acquiring', 2)
    })
    expect(test.client.prepareSource).not.toHaveBeenCalled()
    await test.flow.start(selector)
    expect(test.state()).toMatchObject({
      phase: 'preparing',
      acquisition: { state: 'queued' }
    })
    expect(test.client.submit).not.toHaveBeenCalled()
    await test.flow.refresh()
    expect(test.state()).toMatchObject({
      phase: 'preparing',
      acquisition: { state: 'acquiring' }
    })
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: true,
      value: preparation('ready', 3)
    })
    await test.flow.refresh()
    expect(test.state()).toMatchObject({ phase: 'active', request })
    expect(test.client.submit).toHaveBeenCalledOnce()
    expect(test.client.prepareSource).toHaveBeenCalledOnce()
  })
  it('never submits an unsupported original and preserves the service reason', async () => {
    const test = setup()
    test.client.source.mockResolvedValueOnce({
      ok: false,
      error: { code: 'request_failed', reason: 'source_preparation_required' }
    })
    test.client.prepareSource.mockResolvedValue({
      ok: true,
      value: {
        ...preparation('source_ready'),
        reason: 'unsupported_validation_prerequisites'
      }
    })
    await test.flow.start(selector)
    expect(test.state()).toEqual({
      phase: 'error',
      reason: 'unsupported_validation_prerequisites'
    })
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('retains preparation progress on disconnection, rejects stale polls and a ready source from another revision', async () => {
    const test = setup()
    test.client.source.mockResolvedValueOnce({
      ok: false,
      error: { code: 'request_failed', reason: 'source_preparation_required' }
    })
    test.client.prepareSource.mockResolvedValue({
      ok: true,
      value: preparation('acquiring', 2)
    })
    await test.flow.start(selector)
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: false,
      error: { code: 'transport_indeterminate' }
    })
    await test.flow.refresh()
    expect(test.state()).toMatchObject({
      phase: 'preparing',
      disconnected: true
    })
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: true,
      value: preparation('queued', 1)
    })
    await test.flow.refresh()
    expect(test.state()).toMatchObject({
      acquisition: { state: 'acquiring', status_version: 2 }
    })
    const ready = preparation('ready', 3)
    if (!ready.source) throw new Error('Fixture source missing')
    test.client.sourceStatus.mockResolvedValueOnce({
      ok: true,
      value: {
        ...ready,
        source: {
          ...ready.source,
          registry_revision_id: 'e'.repeat(64),
          revision_id: 'e'.repeat(64)
        }
      }
    })
    await test.flow.refresh()
    expect(test.state()).toMatchObject({
      phase: 'error',
      reason: 'source_binding_invalid'
    })
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('does not convert a workflow version that the verified original does not support', async () => {
    const test = setup()
    test.client.eligibility.mockResolvedValue({
      ok: true,
      value: {
        candidates: [],
        preparations: [],
        unsupported: [
          {
            pack_id: selector.pack_id,
            reason: 'workflow_version_mismatch',
            message: 'Version mismatch'
          }
        ],
        scope: 'scoped_registry_originals',
        matched: false,
        selection_required: false,
        preparation_required: false
      }
    })
    await test.flow.start(selector, [{ type: 'TestNode', version: '0.9.0' }])
    expect(test.state()).toMatchObject({
      phase: 'error',
      reason: 'workflow_version_mismatch'
    })
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('does not submit until consent, then uses the producer reference unchanged', async () => {
    const test = setup()
    expect(test.client.submit).not.toHaveBeenCalled()
    await test.flow.start(selector)
    expect(test.client.source).toHaveBeenCalledWith(
      selector,
      expect.any(AbortSignal)
    )
    expect(test.client.submit).toHaveBeenCalledWith(
      {
        source_ref: 'a'.repeat(64),
        entry_point: 'pack_pin',
        pin_on_ready: true
      },
      expect.any(String),
      expect.any(AbortSignal)
    )
    expect(test.state()).toMatchObject({ phase: 'active', request })
  })
  it('does not submit if source authority is unavailable', async () => {
    const test = setup()
    test.client.source.mockRejectedValueOnce(new Error('source failed'))
    await expect(test.flow.start(selector)).rejects.toThrow('source failed')
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('retries ambiguous submission with byte-identical body and the same key, without reminting', async () => {
    const test = setup()
    test.client.submit.mockResolvedValueOnce({
      ok: false,
      error: { code: 'transport_indeterminate' }
    })
    await test.flow.start(selector)
    expect(test.state()).toMatchObject({ phase: 'retry' })
    const first = test.client.submit.mock.calls[0]
    await test.flow.retry()
    expect(test.client.source).toHaveBeenCalledTimes(1)
    expect(test.client.submit.mock.calls[1]).toEqual(first)
    expect(test.state()).toMatchObject({ phase: 'active', request })
  })
  it('discards source results after an account or workspace change', async () => {
    const test = setup()
    test.client.source.mockImplementationOnce(async () => {
      test.changeScope()
      return {
        ok: true,
        value: {
          source_ref: 'a'.repeat(64),
          entry_point: 'pack_pin',
          pack_id: 'pack',
          revision_id: selector.revision_id
        }
      }
    })
    await test.flow.start(selector)
    expect(test.client.submit).not.toHaveBeenCalled()
  })
  it('refuses to start another request while one is active', async () => {
    const test = setup()
    await test.flow.start(selector)
    await test.flow.start(selector)
    expect(test.client.submit).toHaveBeenCalledTimes(1)
  })
  it('retains newer status when polling returns older versions', async () => {
    const test = setup()
    await test.flow.start(selector)
    test.client.status.mockResolvedValueOnce({
      ok: true,
      value: { ...request, status_version: 3, state: 'waiting_install' }
    })
    await test.flow.refresh()
    await test.flow.refresh()
    expect(test.state()).toMatchObject({
      request: { state: 'waiting_install', status_version: 3 }
    })
  })
  it('does not replace an operation with another operation in a poll response', async () => {
    const test = setup()
    await test.flow.start(selector)
    test.client.status.mockResolvedValueOnce({
      ok: true,
      value: {
        ...request,
        operation_id: 'foreign',
        state: 'ready',
        status_version: 4
      }
    })
    await test.flow.refresh()
    expect(test.state()).toMatchObject({ request, disconnected: true })
  })
  it('withdraws only this subscriber without claiming that the worker stopped', async () => {
    const test = setup()
    await test.flow.start(selector)
    await test.flow.cancel()
    expect(test.client.cancel).toHaveBeenCalledWith(
      request.id,
      expect.any(AbortSignal)
    )
    expect(test.state()).toMatchObject({
      request: { state: 'withdrawn', status_version: 2 }
    })
  })
  it('aborts on disposal without silently cancelling the durable request', async () => {
    const test = setup()
    await test.flow.start(selector)
    const signal = test.client.submit.mock.calls[0]?.[2]
    test.flow.dispose()
    expect(signal?.aborted).toBe(true)
    expect(test.client.cancel).not.toHaveBeenCalled()
  })
})
