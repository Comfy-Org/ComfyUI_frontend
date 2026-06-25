import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'

const { mockClient } = vi.hoisted(() => ({
  mockClient: { get: vi.fn(), post: vi.fn() }
}))

vi.mock('axios', () => ({
  default: {
    create: () => mockClient,
    isAxiosError: (e: unknown): boolean =>
      !!e &&
      typeof e === 'object' &&
      (e as { isAxiosError?: boolean }).isAxiosError === true
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (p: string) => p,
    clientId: 'test-client',
    initialClientId: 'test-client'
  }
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({ isNewManagerUI: ref(true) })
}))

function axiosError(status: number, data?: { message: string }) {
  return { isAxiosError: true, response: { status, data } }
}

describe('useComfyManagerService error messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces the backend security message on a 403 instead of the generic fallback', async () => {
    const backendMessage =
      "ERROR: To use this action, '--listen' must be set to a local IP and security_level must be 'normal-' or lower."
    mockClient.post.mockRejectedValue(
      axiosError(403, { message: backendMessage })
    )

    const service = useComfyManagerService()
    await service.installPack({
      id: 'some-pack',
      version: '1.0.0',
      selected_version: '1.0.0',
      mode: 'remote',
      channel: 'default'
    })

    expect(service.error.value).toBe(backendMessage)
  })

  it('falls back to the generic security message when the 403 has no body', async () => {
    mockClient.post.mockRejectedValue(axiosError(403))

    const service = useComfyManagerService()
    await service.installPack({
      id: 'some-pack',
      version: '1.0.0',
      selected_version: '1.0.0',
      mode: 'remote',
      channel: 'default'
    })

    expect(service.error.value).toContain('security error has occurred')
  })
})
