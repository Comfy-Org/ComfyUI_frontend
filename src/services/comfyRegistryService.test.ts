import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComfyRegistryService } from '@/services/comfyRegistryService'

const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn()
  }
}))

describe('useComfyRegistryService', () => {
  let service: ReturnType<typeof useComfyRegistryService>

  beforeEach(() => {
    vi.clearAllMocks()
    mockAxiosInstance.get.mockResolvedValue({ data: {} })
    mockAxiosInstance.post.mockResolvedValue({ data: {} })
    service = useComfyRegistryService()
  })

  it('initializes with idle state', () => {
    expect(service.isLoading.value).toBe(false)
    expect(service.error.value).toBeNull()
  })

  describe('request routing', () => {
    it('getNodeDefs hits the comfy-nodes endpoint', async () => {
      await service.getNodeDefs({ packId: 'pack', version: '1.0.0' })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/nodes/pack/versions/1.0.0/comfy-nodes',
        expect.objectContaining({ params: {} })
      )
    })

    it('getNodeDefs returns null without a packId or version', async () => {
      const result = await service.getNodeDefs({ packId: '', version: '' })

      expect(result).toBeNull()
      expect(mockAxiosInstance.get).not.toHaveBeenCalled()
    })

    it('search hits the search endpoint', async () => {
      await service.search({ search: 'sampler' })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/nodes/search',
        expect.objectContaining({ params: { search: 'sampler' } })
      )
    })

    it('getPublisherById hits the publisher endpoint', async () => {
      await service.getPublisherById('pub-1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/publishers/pub-1',
        expect.any(Object)
      )
    })

    it('listPacksForPublisher forwards include_banned', async () => {
      await service.listPacksForPublisher('pub-1', true)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/publishers/pub-1/nodes',
        expect.objectContaining({ params: { include_banned: true } })
      )
    })

    it('postPackReview posts the star rating', async () => {
      await service.postPackReview('pack', 5)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/nodes/pack/reviews',
        null,
        expect.objectContaining({ params: { star: 5 } })
      )
    })

    it('listAllPacks hits the nodes endpoint', async () => {
      await service.listAllPacks({ page: 1 })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/nodes',
        expect.objectContaining({ params: { page: 1 } })
      )
    })

    it('getPackVersions hits the versions endpoint', async () => {
      await service.getPackVersions('pack')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/nodes/pack/versions',
        expect.any(Object)
      )
    })

    it('getPackByVersion hits the specific version endpoint', async () => {
      await service.getPackByVersion('pack', 'v-1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/nodes/pack/versions/v-1',
        expect.any(Object)
      )
    })

    it('getPackById hits the node endpoint', async () => {
      await service.getPackById('pack')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/nodes/pack',
        expect.any(Object)
      )
    })

    it('inferPackFromNodeName hits the comfy-nodes lookup endpoint', async () => {
      await service.inferPackFromNodeName('KSampler')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/comfy-nodes/KSampler/node',
        expect.any(Object)
      )
    })

    it('getBulkNodeVersions posts the identifiers', async () => {
      const nodeVersions = [{ node_id: 'pack', version: '1.0.0' }]
      await service.getBulkNodeVersions(nodeVersions)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bulk/nodes/versions',
        { node_versions: nodeVersions },
        expect.any(Object)
      )
    })

    it('returns the response data on success', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 'pack' } })

      const result = await service.getPackById('pack')

      expect(result).toEqual({ id: 'pack' })
    })
  })

  describe('error mapping', () => {
    it('prefers a route-specific message for a matching status', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: {} }
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      const result = await service.getPackById('missing')

      expect(result).toBeNull()
      expect(service.error.value).toBe(
        'Pack not found: The pack with ID missing does not exist'
      )
    })

    it('maps generic status codes to friendly messages', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401, data: {} }
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await service.search()

      expect(service.error.value).toBe('Unauthorized: Authentication required')
    })

    it('falls back to the axios message when there is no response', async () => {
      mockAxiosInstance.get.mockRejectedValue({ message: 'Network Error' })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await service.search()

      expect(service.error.value).toBe(
        'Failed to perform search: Network Error'
      )
    })

    it('handles non-axios errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('boom'))
      vi.mocked(axios.isAxiosError).mockReturnValue(false)

      await service.search()

      expect(service.error.value).toBe('Failed to perform search: boom')
    })
  })
})
