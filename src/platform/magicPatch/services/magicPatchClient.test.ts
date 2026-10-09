import type { RequestStatus } from '@comfyorg/magic-patch-types'
import { createHash, webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { createMagicPatchClient } from './magicPatchClient'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

const request: RequestStatus = {
  id: 'a'.repeat(32),
  operation_id: 'b'.repeat(32),
  state: 'waiting_conversion',
  operation_status: 'queued',
  status_version: 1
}

const scopeGuard = {
  capture: () => true,
  current: (captured: boolean) => captured
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
})

describe('Magic Patch client', () => {
  it('rejects invalid source inputs before admission and returns an explicit failure', async () => {
    const transport = vi.fn(async () => Response.json(request))
    const client = createMagicPatchClient(transport, () => true, scopeGuard)
    await expect(
      client.submit(
        { source_ref: 'short', entry_point: 'pack_pin', pin_on_ready: true },
        'token'
      )
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_request' } })
    expect(transport).not.toHaveBeenCalled()
  })

  it('reports bounded failure codes without including rejected response data', async () => {
    const client = createMagicPatchClient(
      async () => Response.json({ ...request, private_log: 'secret-marker' }),
      () => true,
      scopeGuard
    )
    await expect(client.status(request.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'invalid_response' }),
      { errorType: 'magic_patch_request_failure' }
    )
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'secret-marker'
    )
  })

  it('rejects a response after the account generation changes', async () => {
    let generation = 1
    const guard = {
      capture: () => generation,
      current: (captured: number) => captured === generation
    }
    const client = createMagicPatchClient(
      async () => {
        generation = 2
        return Response.json(request)
      },
      () => true,
      guard
    )
    await expect(client.status(request.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'scope_changed' }
    })
  })

  it('rejects an oversized page instead of displaying an unbounded response', async () => {
    const client = createMagicPatchClient(
      async () =>
        Response.json({ requests: Array.from({ length: 101 }, () => request) }),
      () => true,
      scopeGuard
    )
    await expect(client.list()).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
  })

  it('makes no network request when unavailable', async () => {
    const transport = vi.fn(async () => Response.json(request))
    const client = createMagicPatchClient(transport, () => false, scopeGuard)
    await expect(client.status(request.id)).resolves.toMatchObject({
      ok: false,
      error: { status: 503 }
    })
    expect(transport).not.toHaveBeenCalled()
  })

  it('preserves the immutable submission token, source and abort signal', async () => {
    const transport = vi.fn(async () => Response.json(request, { status: 202 }))
    const client = createMagicPatchClient(transport, () => true, scopeGuard)
    const input = {
      source_ref: 'c'.repeat(64),
      entry_point: 'workflow_load' as const,
      pin_on_ready: true
    }
    const controller = new AbortController()
    await client.submit(input, 'stable-token', controller.signal)
    expect(transport).toHaveBeenCalledWith(
      '/magic-patch/requests',
      expect.objectContaining({
        signal: controller.signal,
        body: JSON.stringify(input),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'stable-token'
        }
      })
    )
  })

  it('rejects malformed statuses and a response for a different request', async () => {
    const invalid = createMagicPatchClient(
      async () => Response.json({ ...request, operation_status: 'ready' }),
      () => true,
      scopeGuard
    )
    await expect(invalid.status(request.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
    const other = createMagicPatchClient(
      async () => Response.json({ ...request, id: 'd'.repeat(32) }),
      () => true,
      scopeGuard
    )
    await expect(other.status(request.id)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
  })

  it('encodes cursor navigation and preserves terminal requests', async () => {
    const transport = vi.fn(async () =>
      Response.json({
        requests: [{ ...request, operation_status: 'completed' }]
      })
    )
    const client = createMagicPatchClient(transport, () => true, scopeGuard)
    const page = await client.list('a&b=1')
    expect(page).toMatchObject({
      ok: true,
      value: {
        requests: [expect.objectContaining({ operation_status: 'completed' })]
      }
    })
    expect(transport).toHaveBeenCalledWith(
      '/magic-patch/requests?limit=50&after=a%26b%3D1',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('does not interpret a cancellation acknowledgement as stopped execution', async () => {
    const client = createMagicPatchClient(
      async () =>
        Response.json({
          request: { ...request, state: 'withdrawn' },
          worker_cancellation: 'acknowledged'
        }),
      () => true,
      scopeGuard
    )
    const result = await client.cancel(request.id)
    expect(result).toMatchObject({
      ok: true,
      value: { worker_cancellation: 'acknowledged' }
    })
    expect(result).toMatchObject({
      ok: true,
      value: { request: { operation_status: 'queued' } }
    })
  })

  it('verifies exact report bytes against the expected immutable digest', async () => {
    const body = JSON.stringify({ outcome: 'failed', incomplete: true })
    const digest = createHash('sha256').update(body).digest('hex')
    const client = createMagicPatchClient(
      async () =>
        new Response(body, { headers: { 'X-Content-SHA256': digest } }),
      () => true,
      scopeGuard
    )
    await expect(client.report(request.id, digest)).resolves.toEqual({
      ok: true,
      value: { outcome: 'failed', incomplete: true }
    })
    const tampered = createMagicPatchClient(
      async () =>
        new Response(body + ' ', { headers: { 'X-Content-SHA256': digest } }),
      () => true,
      scopeGuard
    )
    await expect(tampered.report(request.id, digest)).resolves.toMatchObject({
      ok: false,
      error: { code: 'report_mismatch' }
    })
    await expect(
      client.report(request.id, 'e'.repeat(64))
    ).resolves.toMatchObject({ ok: false, error: { code: 'report_mismatch' } })
  })
})
