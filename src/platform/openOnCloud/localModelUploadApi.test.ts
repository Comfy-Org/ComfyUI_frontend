import type { AuthHeader } from '@comfyorg/api-client/authTypes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'
import { bindLocalOpenOnCloudGrant } from '@/platform/openOnCloud/localOpenOnCloudRollout'
import { ModelUploadRolloutDisabled } from '@/platform/assets/services/modelFileUploadApi'
import type { UploadRouteRequest } from '@/platform/assets/services/modelFileUploadApi'
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
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/openOnCloud/localOpenOnCloudRollout'))
vi.mock(import('firebase/auth'), { spy: true })

const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const workspaceAuth = {
  headers: { Authorization: 'Bearer workspace-token' },
  workspaceId: 'ws-active'
} satisfies { headers: AuthHeader; workspaceId: string }

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
  const allowsModelTransfer =
    vi.fn<ReturnType<typeof bindLocalOpenOnCloudGrant>['allowsModelTransfer']>()

  beforeEach(() => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: true
    })
    allowsModelTransfer.mockResolvedValue(true)
    vi.mocked(bindLocalOpenOnCloudGrant).mockReturnValue({
      isCurrent: () => true,
      revalidate: async () => true,
      allowsModelTransfer
    })
  })

  it('sends uploads to the Cloud API origin with workspace authorization', async () => {
    stubFirebaseAuthHarness()
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthContext').mockResolvedValue(
      workspaceAuth
    )
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 201 }))

    const response = await cloudUploadRequest('/assets/uploads', {
      method: 'POST'
    })

    expect(response.status).toBe(201)
    expect(fetch).toHaveBeenCalledWith(
      new URL('/api/assets/uploads', getBuildTimeComfyCloudBaseUrl()).href,
      {
        method: 'POST',
        headers: new Headers({ Authorization: 'Bearer workspace-token' }),
        redirect: 'error'
      }
    )
  })

  it('checks the current rollout after workspace authorization and skips a disabled start', async () => {
    stubFirebaseAuthHarness()
    let authorize!: (context: typeof workspaceAuth) => void
    const auth = new Promise<typeof workspaceAuth>((resolve) => {
      authorize = resolve
    })
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthContext').mockReturnValue(auth)
    const start = cloudUploadRequest('/assets/uploads', { method: 'POST' })
    expect(allowsModelTransfer).not.toHaveBeenCalled()

    allowsModelTransfer.mockResolvedValue(false)
    authorize(workspaceAuth)

    await expect(start).rejects.toBeInstanceOf(ModelUploadRolloutDisabled)
    expect(allowsModelTransfer).toHaveBeenCalledExactlyOnceWith({
      refresh: true
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps completion available while uploads are disabled', async () => {
    stubFirebaseAuthHarness()
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthContext').mockResolvedValue(
      workspaceAuth
    )
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 202 }))

    const response = await cloudUploadRequest(
      '/assets/uploads/staged/complete',
      {
        method: 'POST'
      }
    )

    expect(response.status).toBe(202)
    expect(allowsModelTransfer).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('stops waiting for completion credentials at the operation deadline', async () => {
    stubFirebaseAuthHarness()
    const credentials = vi
      .spyOn(useAuthStore(), 'getWorkspaceAuthContext')
      .mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()
    const result = cloudUploadRequest(
      '/assets/uploads/staged/complete',
      { method: 'POST', signal: controller.signal },
      workspaceAuth.workspaceId
    )

    expect(credentials).toHaveBeenCalledOnce()
    controller.abort(new DOMException('Test deadline', 'TimeoutError'))

    await expect(result).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for([
    { label: 'no credential', context: { headers: null } },
    {
      label: 'an account credential',
      context: { headers: workspaceAuth.headers }
    },
    {
      label: 'a different workspace',
      context: { ...workspaceAuth, workspaceId: 'ws-other' }
    }
  ])('refuses to complete an upload with $label', async ({ context }) => {
    stubFirebaseAuthHarness()
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthContext').mockResolvedValue(
      context
    )

    await expect(
      cloudUploadRequest(
        '/assets/uploads/staged/complete',
        { method: 'POST' },
        workspaceAuth.workspaceId
      )
    ).resolves.toMatchObject({ status: 401 })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('readCloudUploadFolders', () => {
  it('reads available folders without native AbortSignal.timeout', async () => {
    const nativeTimeout = Object.getOwnPropertyDescriptor(
      AbortSignal,
      'timeout'
    )
    stubFirebaseAuthHarness()
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthContext').mockResolvedValue(
      workspaceAuth
    )
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
  it('settles when a local model-list response body stalls', async () => {
    const timeout = new AbortController()
    const timer = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeout.signal)
    const answer = answers('hangBody')
    vi.mocked(api.fetchApi).mockImplementation((route, init) =>
      answer(route, init ?? {})
    )

    try {
      const sizes = readLocalModelSizes('loras')
      timeout.abort()
      await expect(sizes).resolves.toEqual(new Map())
    } finally {
      timer.mockRestore()
    }
  })

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

  it.for([
    { label: 'a negative size', metadata: { pathIndex: 0, size: -1 } },
    { label: 'a fractional size', metadata: { pathIndex: 0, size: 1.5 } },
    { label: 'a missing path index', metadata: { size: 16 } }
  ])('rejects local model metadata with $label', async ({ metadata }) => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json([{ name: 'style.safetensors', ...metadata }])
    )

    await expect(readLocalModelSizes('loras')).resolves.toEqual(new Map())
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
      label: 'the task has expired',
      responses: [new Response(null, { status: 404 })],
      expected: { ok: false, reason: 'taskUnavailable' }
    },
    {
      label: 'the answer is not JSON',
      responses: [new Response('<html>', { status: 200 })],
      expected: { ok: false, reason: 'storagePending' }
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

  it('keeps the task unconfirmed past the polling deadline', async () => {
    const request = answers(new Response(null, { status: 503 }))

    await expect(outcome(request, 31 * 60_000)).resolves.toEqual({
      ok: false,
      reason: 'storagePending'
    })
  })
})
