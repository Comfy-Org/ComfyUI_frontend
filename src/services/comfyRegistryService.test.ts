import { describe, expect, it, vi } from 'vitest'

const mockRegistryApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockRegistryApiClient),
    isAxiosError: vi.fn(() => false)
  }
}))

import { useComfyRegistryService } from '@/services/comfyRegistryService'

describe('useComfyRegistryService', () => {
  it.for([null, undefined, '', 'undefined'])(
    'does not query for node name %s',
    async (nodeName) => {
      const result = await Reflect.apply(
        useComfyRegistryService().inferPackFromNodeName,
        undefined,
        [nodeName]
      )

      expect(result).toBeNull()
      expect(mockRegistryApiClient.get).not.toHaveBeenCalled()
    }
  )
})
