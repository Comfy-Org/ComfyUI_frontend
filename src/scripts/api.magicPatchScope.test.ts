import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMagicPatchClient } from '@/platform/magicPatch/services/magicPatchClient'
import { ComfyApi } from '@/scripts/api'

const { authHeader, remint } = vi.hoisted(() => ({
  authHeader: vi.fn(),
  remint: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ isInitialized: true, getAuthHeader: authHeader })
}))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: { unifiedCloudAuthEnabled: true } })
}))
vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ remintUnifiedOnce: remint })
}))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => null }))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

const status = {
  id: 'a'.repeat(32),
  operation_id: 'b'.repeat(32),
  state: 'waiting_conversion',
  operation_status: 'queued',
  status_version: 1
}
const input = {
  source_ref: 'c'.repeat(64),
  entry_point: 'pack_pin' as const,
  pin_on_ready: true
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(status))
  )
})

describe('Magic Patch authenticated dispatch', () => {
  it.for(['submit', 'cancel'] as const)(
    'sends zero %s mutations after scope changes during auth preparation',
    async (command) => {
      const api = new ComfyApi()
      api.user = 'account-A'
      let generation = 1
      let resume: (value: { Authorization: string }) => void = () => {}
      authHeader.mockImplementation(
        () =>
          new Promise<{ Authorization: string }>((resolve) => {
            resume = resolve
          })
      )
      const client = createMagicPatchClient(
        api.fetchApi.bind(api),
        () => true,
        {
          capture: () => generation,
          current: (captured) => captured === generation
        }
      )
      const pending =
        command === 'submit'
          ? client.submit(input, 'token')
          : client.cancel(status.id)
      await vi.waitFor(() => expect(authHeader).toHaveBeenCalled())
      generation = 2
      api.user = 'account-B'
      resume({ Authorization: 'Bearer new-scope' })
      await expect(pending).resolves.toMatchObject({
        ok: false,
        error: { code: 'scope_changed' }
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('sends no retry after a scope change during remint', async () => {
    const api = new ComfyApi()
    let generation = 1
    authHeader.mockResolvedValue({ Authorization: 'Bearer initial' })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }))
    let resume: (value: string) => void = () => {}
    remint.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resume = resolve
        })
    )
    const client = createMagicPatchClient(api.fetchApi.bind(api), () => true, {
      capture: () => generation,
      current: (captured) => captured === generation
    })
    const pending = client.submit(input, 'token')
    await vi.waitFor(() => expect(remint).toHaveBeenCalled())
    generation = 2
    api.user = 'account-B'
    resume('new-scope')
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'scope_changed' }
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends zero mutations when readiness disappears during auth preparation', async () => {
    const api = new ComfyApi()
    let available = true
    let resume: (value: null) => void = () => {}
    authHeader.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resume = resolve
        })
    )
    const client = createMagicPatchClient(
      api.fetchApi.bind(api),
      () => available,
      {
        capture: () => 1,
        current: () => true
      }
    )
    const pending = client.submit(input, 'token')
    await vi.waitFor(() => expect(authHeader).toHaveBeenCalled())
    available = false
    resume(null)
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'unavailable' }
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
