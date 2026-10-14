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
  it.for([401, 403, 429, 503])(
    'retains safe error codes and HTTP %i without exposing response messages',
    async (status) => {
      const client = createMagicPatchClient(
        async () =>
          Response.json(
            {
              code: 'source_access_denied',
              message: 'private-response-marker'
            },
            { status }
          ),
        () => true,
        scopeGuard
      )
      const result = await client.prepareWorkflowSource({
        cnr_id: 'example',
        ver: '2.0.0',
        node_types: ['ExampleNode']
      })
      expect(result).toEqual({
        ok: false,
        error: {
          code: status === 503 ? 'unavailable' : 'request_failed',
          status,
          reason: 'source_access_denied'
        }
      })
      expect(
        JSON.stringify([result, vi.mocked(reportError).mock.calls])
      ).not.toContain('private-response-marker')
    }
  )

  it.for([
    { code: 'PRIVATE/secret', message: 'private-marker' },
    { code: 'a'.repeat(81), message: 'private-marker' },
    { code: 'source_access_denied', message: 'private-marker', token: 'secret' }
  ])('ignores unsafe or unrecognized error bodies %j', async (body) => {
    const client = createMagicPatchClient(
      async () => Response.json(body, { status: 403 }),
      () => true,
      scopeGuard
    )
    expect(await client.status(request.id)).toEqual({
      ok: false,
      error: { code: 'request_failed', status: 403 }
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'private-marker'
    )
  })

  it('keeps the actual HTTP status when an error body is malformed', async () => {
    const client = createMagicPatchClient(
      async () => new Response('private-invalid-json', { status: 401 }),
      () => true,
      scopeGuard
    )
    expect(await client.status(request.id)).toEqual({
      ok: false,
      error: { code: 'invalid_response', status: 401 }
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'private-invalid-json'
    )
  })

  it('cancels oversized error bodies and retains their HTTP status', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({ cancel })
    const client = createMagicPatchClient(
      async () =>
        new Response(body, {
          status: 403,
          headers: { 'Content-Length': String(1024 * 1024 + 1) }
        }),
      () => true,
      scopeGuard
    )
    expect(await client.status(request.id)).toEqual({
      ok: false,
      error: { code: 'response_too_large', status: 403 }
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('preserves scope fencing while reading a failed HTTP response', async () => {
    let generation = 1
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          generation = 2
          controller.enqueue(
            new TextEncoder().encode('{"code":"denied","message":"private"}')
          )
        },
        cancel
      },
      { highWaterMark: 0 }
    )
    const client = createMagicPatchClient(
      async () => new Response(body, { status: 403 }),
      () => true,
      {
        capture: () => generation,
        current: (captured) => captured === generation
      }
    )
    expect(await client.status(request.id)).toEqual({
      ok: false,
      error: { code: 'scope_changed' }
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('bounds stalled error bodies without losing the service status', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const client = createMagicPatchClient(
      async () =>
        new Response(new ReadableStream<Uint8Array>({ cancel }), {
          status: 503
        }),
      () => true,
      scopeGuard
    )
    const pending = client.status(request.id)
    await vi.advanceTimersByTimeAsync(10000)
    expect(await pending).toEqual({
      ok: false,
      error: { code: 'response_timeout', status: 503 }
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  const acquisition = {
    acquisition_id: 'a'.repeat(32),
    state: 'queued',
    status_version: 1,
    source_ref: null,
    reason: null,
    conversion_supported: false,
    message: 'Queued',
    progress: {
      stage: 'source_preparation',
      state: 'queued',
      message: 'Queued'
    }
  }

  it('binds a workflow discovery to every confirmed source selector field', async () => {
    const input = {
      cnr_id: 'example',
      aux_id: 'owner/repo.git/',
      ver: '2.0.0',
      node_types: ['ExampleNode']
    }
    const transport = vi.fn<Parameters<typeof createMagicPatchClient>[0]>(
      async () => Response.json(acquisition)
    )
    transport
      .mockResolvedValueOnce(Response.json(acquisition))
      .mockResolvedValueOnce(
        Response.json({
          workflow_selector: {
            ...input,
            aux_id: 'https://github.com/owner/repo'
          },
          acquisition,
          resolved: null
        })
      )
    const client = createMagicPatchClient(transport, () => true, scopeGuard)
    await expect(client.prepareWorkflowSource(input)).resolves.toEqual({
      ok: true,
      value: acquisition
    })
    expect(transport.mock.calls.map(([route]) => route)).toEqual([
      '/magic-patch/sources/workflow',
      `/magic-patch/workflow-source-discoveries/${acquisition.acquisition_id}`
    ])
  })

  it.for([
    { cnr_id: 'other' },
    { ver: '2.1.2' },
    { node_types: ['OtherNode'] }
  ])('refuses mismatched workflow source evidence %j', async (mismatch) => {
    const input = {
      cnr_id: 'example',
      ver: '2.0.0',
      node_types: ['ExampleNode']
    }
    const transport = vi.fn<Parameters<typeof createMagicPatchClient>[0]>(
      async () => Response.json(acquisition)
    )
    transport
      .mockResolvedValueOnce(Response.json(acquisition))
      .mockResolvedValueOnce(
        Response.json({
          workflow_selector: { ...input, ...mismatch },
          acquisition,
          resolved: null
        })
      )
    const client = createMagicPatchClient(transport, () => true, scopeGuard)
    await expect(client.prepareWorkflowSource(input)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
  })

  it.for([
    { ver: '2.0.0' },
    { cnr_id: 'example', ver: 'latest' },
    { cnr_id: 'example', ver: '2.0.0', node_types: ['Node', 'Node'] }
  ])(
    'rejects incomplete or ambiguous workflow source inputs %j',
    async (input) => {
      const transport = vi.fn<Parameters<typeof createMagicPatchClient>[0]>(
        async () => Response.json(acquisition)
      )
      const client = createMagicPatchClient(transport, () => true, scopeGuard)
      await expect(client.prepareWorkflowSource(input)).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_request' }
      })
      expect(transport).not.toHaveBeenCalled()
    }
  )

  it('retains the source-preparation requirement without exposing the rejected response body to telemetry', async () => {
    const client = createMagicPatchClient(
      async () =>
        Response.json(
          { code: 'source_preparation_required', message: 'private-marker' },
          { status: 422 }
        ),
      () => true,
      scopeGuard
    )
    expect(
      await client.source({ pack_id: 'example', revision_id: 'c'.repeat(64) })
    ).toMatchObject({
      ok: false,
      error: { status: 422, reason: 'source_preparation_required' }
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain(
      'private-marker'
    )
  })
  it('rejects source status from another acquisition and cancels preparation after a scope change', async () => {
    let generation = 1
    const guard = {
      capture: () => generation,
      current: (captured: number) => captured === generation
    }
    const value = {
      acquisition_id: 'a'.repeat(32),
      state: 'queued',
      status_version: 1,
      source_ref: null,
      reason: null,
      conversion_supported: false,
      message: 'Queued',
      progress: {
        stage: 'source_preparation',
        state: 'queued',
        message: 'Queued'
      }
    }
    const transport = vi.fn(async () => Response.json(value))
    const client = createMagicPatchClient(transport, () => true, guard)
    expect(await client.sourceStatus('b'.repeat(32))).toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
    transport.mockImplementationOnce(async () => {
      generation++
      return Response.json(value)
    })
    expect(
      await client.prepareSource({
        pack_id: 'example',
        revision_id: 'c'.repeat(64)
      })
    ).toMatchObject({ ok: false, error: { code: 'scope_changed' } })
  })
  it('accepts only a minted source bound to the selected pack and revision', async () => {
    const selector = { pack_id: 'example', revision_id: 'c'.repeat(64) }
    const transport = vi.fn(async () =>
      Response.json({
        ...selector,
        source_ref: 'd'.repeat(64),
        entry_point: 'pack_pin'
      })
    )
    const client = createMagicPatchClient(transport, () => true, scopeGuard)
    await expect(client.source(selector)).resolves.toMatchObject({
      ok: true,
      value: { source_ref: 'd'.repeat(64) }
    })
    transport.mockResolvedValueOnce(
      Response.json({
        ...selector,
        revision_id: 'e'.repeat(64),
        source_ref: 'd'.repeat(64),
        entry_point: 'pack_pin'
      })
    )
    await expect(client.source(selector)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_response' }
    })
  })

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
      }),
      expect.any(Function)
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
      expect.objectContaining({ method: 'GET' }),
      expect.any(Function)
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

describe('Magic Patch response byte limits v1', () => {
  it('rejects declared oversized JSON without reading its body', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({ cancel })
    const client = createMagicPatchClient(
      async () =>
        new Response(body, {
          headers: { 'Content-Length': String(1024 * 1024 + 1) }
        }),
      () => true,
      scopeGuard
    )
    await expect(client.list()).resolves.toMatchObject({
      ok: false,
      error: { code: 'response_too_large' }
    })
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.for(['absent', 'understated'] as const)(
    'bounds streamed JSON with %s content length',
    async (length) => {
      const cancel = vi.fn()
      const bytes = new TextEncoder().encode(
        '{"requests":[]}' + ' '.repeat(1024 * 1024)
      )
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes)
        },
        cancel
      })
      const client = createMagicPatchClient(
        async () =>
          new Response(body, {
            headers: length === 'understated' ? { 'Content-Length': '1' } : {}
          }),
        () => true,
        scopeGuard
      )
      await expect(client.list()).resolves.toMatchObject({
        ok: false,
        error: { code: 'response_too_large' }
      })
      expect(cancel).toHaveBeenCalledTimes(1)
    }
  )

  it('bounds report bytes before hashing and parsing', async () => {
    const cancel = vi.fn()
    const bytes = new TextEncoder().encode('{}' + ' '.repeat(8 * 1024 * 1024))
    const digest = createHash('sha256').update(bytes).digest('hex')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
      },
      cancel
    })
    const hash = vi.spyOn(crypto.subtle, 'digest')
    const client = createMagicPatchClient(
      async () =>
        new Response(body, {
          headers: { 'X-Content-SHA256': digest }
        }),
      () => true,
      scopeGuard
    )
    await expect(client.report(request.id, digest)).resolves.toMatchObject({
      ok: false,
      error: { code: 'response_too_large' }
    })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(hash).not.toHaveBeenCalled()
  })

  it('accepts JSON at the exact byte ceiling across chunks', async () => {
    const prefix = new TextEncoder().encode('{"requests":[]}')
    const bytes = new Uint8Array(1024 * 1024).fill(32)
    bytes.set(prefix)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 100))
        controller.enqueue(bytes.subarray(100))
        controller.close()
      }
    })
    const client = createMagicPatchClient(
      async () => new Response(body),
      () => true,
      scopeGuard
    )
    await expect(client.list()).resolves.toEqual({
      ok: true,
      value: { requests: [] }
    })
  })

  it('cancels a response when the scope changes during streaming', async () => {
    let generation = 1
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          generation = 2
          controller.enqueue(new TextEncoder().encode('{"requests":[]}'))
        },
        cancel
      },
      { highWaterMark: 0 }
    )
    const client = createMagicPatchClient(
      async () => new Response(body),
      () => true,
      {
        capture: () => generation,
        current: (captured) => captured === generation
      }
    )
    await expect(client.list()).resolves.toMatchObject({
      ok: false,
      error: { code: 'scope_changed' }
    })
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})

describe('Magic Patch body consumption policy v2', () => {
  it.for(['empty', 'one-byte'] as const)(
    'stops excessive %s stream fragmentation before parse',
    async (kind) => {
      let reads = 0
      const cancel = vi.fn()
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            if (++reads <= 16384) {
              controller.enqueue(
                kind === 'empty' ? new Uint8Array() : new Uint8Array([32])
              )
            } else {
              controller.enqueue(new TextEncoder().encode('{"requests":[]}'))
              controller.close()
            }
          },
          cancel
        },
        { highWaterMark: 0 }
      )
      const client = createMagicPatchClient(
        async () => new Response(body),
        () => true,
        scopeGuard
      )
      await expect(client.list()).resolves.toMatchObject({
        ok: false,
        error: { code: 'response_too_fragmented' }
      })
      expect(reads).toBe(16384)
      expect(cancel).toHaveBeenCalledTimes(1)
    }
  )

  it('ends a stalled body at its own deadline and cancels the reader', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    const body = new ReadableStream<Uint8Array>({ cancel })
    const client = createMagicPatchClient(
      async () => new Response(body),
      () => true,
      scopeGuard
    )
    const pending = client.list()
    await vi.advanceTimersByTimeAsync(10000)
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'response_timeout' }
    })
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('unblocks a pending read on caller abort even when injected transport ignores its signal', async () => {
    const cancel = vi.fn()
    const pull = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      { pull, cancel },
      { highWaterMark: 0 }
    )
    const client = createMagicPatchClient(
      async () => new Response(body),
      () => true,
      scopeGuard
    )
    const controller = new AbortController()
    const pending = client.list(undefined, controller.signal)
    await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(1))
    controller.abort()
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'transport_indeterminate' }
    })
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})

describe('Magic Patch monotonic body deadline', () => {
  it('rejects a body delivered after its deadline while the timer callback is withheld', async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    let resume: () => void = () => {}
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          resume = () => {
            controller.enqueue(new TextEncoder().encode('{"requests":[]}'))
            controller.close()
          }
        }
      },
      { highWaterMark: 0 }
    )
    const client = createMagicPatchClient(
      async () => new Response(body),
      () => true,
      scopeGuard
    )
    const pending = client.list()
    await vi.advanceTimersByTimeAsync(0)
    now = 10000
    resume()
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'response_timeout' }
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
