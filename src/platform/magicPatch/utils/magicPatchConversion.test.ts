import { describe, expect, it, vi } from 'vitest'
import type { RequestStatus } from '@comfyorg/magic-patch-types'
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
describe('pack conversion journey', () => {
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
