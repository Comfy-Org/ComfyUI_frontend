import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import type { UploadRouteRequest } from '@/platform/workspace/api/modelFileUploadApi'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import {
  cloudUploadRequest,
  readCloudUploadFolders,
  readLocalModelSizes,
  waitForStoredModel
} from './localModelUploadApi'

vi.mock(import('@/scripts/api'))
vi.mock(import('firebase/auth'), { spy: true })

const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'

function task(status: string, extra: Record<string, unknown> = {}) {
  return Response.json({
    id: TASK_ID,
    idempotency_key: 'upload',
    task_name: 'model_upload',
    status,
    payload: {},
    create_time: '2026-11-18T00:00:00Z',
    update_time: '2026-11-18T00:00:01Z',
    ...extra
  })
}

function answers(
  ...responses: Array<Response | 'hang' | 'hangBody'>
): UploadRouteRequest {
  return vi.fn((_route: string, init: RequestInit) => {
    const next = responses.length > 1 ? responses.shift() : responses[0]
    if (next === 'hangBody') {
      const stream = new ReadableStream({
        start(controller) {
          init.signal?.addEventListener('abort', () =>
            controller.error(init.signal?.reason)
          )
        }
      })
      return Promise.resolve(new Response(stream))
    }
    if (next !== 'hang') return Promise.resolve(next!.clone())
    return new Promise<Response>((_resolve, reject) =>
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError'))
      )
    )
  })
}

describe('cloudUploadRequest', () => {
  it('sends uploads to the Cloud API origin with workspace authorization', async () => {
    stubFirebaseAuthHarness()
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthHeader').mockResolvedValue({
      Authorization: 'Bearer workspace-token'
    })
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 201 }))

    const response = await cloudUploadRequest('/assets/uploads', {
      method: 'POST'
    })

    expect(response.status).toBe(201)
    expect(fetch).toHaveBeenCalledWith(
      `${getComfyApiBaseUrl()}/api/assets/uploads`,
      {
        method: 'POST',
        headers: new Headers({ Authorization: 'Bearer workspace-token' })
      }
    )
  })
})

describe('readCloudUploadFolders', () => {
  it('reads available folders without native AbortSignal.timeout', async () => {
    const nativeTimeout = Object.getOwnPropertyDescriptor(
      AbortSignal,
      'timeout'
    )
    stubFirebaseAuthHarness()
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthHeader').mockResolvedValue(null)
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ model_upload_folders: ['loras'] })
    )
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: undefined
    })

    try {
      await expect(readCloudUploadFolders()).resolves.toEqual(['loras'])
    } finally {
      if (nativeTimeout)
        Object.defineProperty(AbortSignal, 'timeout', nativeTimeout)
      else Reflect.deleteProperty(AbortSignal, 'timeout')
    }
  })
})

describe('readLocalModelSizes', () => {
  it('uses the same model as Core when two local roots contain the same filename', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json([
        { name: 'style.safetensors', pathIndex: 0, size: 16 },
        { name: 'style.safetensors', pathIndex: 1, size: 32 }
      ])
    )

    const sizes = await readLocalModelSizes('loras')

    expect(sizes.get('style.safetensors')).toBe(16)
  })
})

describe('waitForStoredModel', () => {
  beforeEach(() => vi.useFakeTimers())

  async function outcome(request: UploadRouteRequest, advanceMs: number) {
    const result = waitForStoredModel(
      TASK_ID,
      new AbortController().signal,
      request
    )
    await vi.advanceTimersByTimeAsync(advanceMs)
    return result
  }

  it.for([
    {
      label: 'the task completes after a busy answer',
      responses: [new Response(null, { status: 503 }), task('completed')],
      expected: { ok: true }
    },
    {
      label: 'the task fails',
      responses: [task('failed', { error_message: 'bad file' })],
      expected: { ok: false, reason: 'failed', message: 'bad file' }
    },
    {
      label: 'the answer is not JSON',
      responses: [new Response('<html>', { status: 200 })],
      expected: { ok: false, reason: 'failed' }
    }
  ])('settles when $label', async ({ responses, expected }) => {
    await expect(outcome(answers(...responses), 10_000)).resolves.toEqual(
      expected
    )
  })

  it.for(['hang', 'hangBody'] as const)(
    'retries a stalled poll (%s)',
    async (stall) => {
      const request = answers(stall, task('completed'))

      await expect(outcome(request, 20_000)).resolves.toEqual({ ok: true })
      expect(request).toHaveBeenCalledTimes(2)
    }
  )

  it('fails once the task stays unreachable past the deadline', async () => {
    const request = answers(new Response(null, { status: 503 }))

    await expect(outcome(request, 31 * 60_000)).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })
  })
})
