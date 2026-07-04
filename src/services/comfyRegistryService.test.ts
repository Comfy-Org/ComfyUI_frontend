import { beforeEach, describe, expect, it, vi } from 'vitest'

interface AxiosLikeError extends Error {
  isAxiosError: true
  response?: {
    status: number
    data?: {
      message?: string
    }
  }
}

const mockClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

const mockAxios = vi.hoisted(() => ({
  create: vi.fn(() => mockClient),
  isAxiosError: vi.fn(
    (error: unknown): error is AxiosLikeError =>
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      error.isAxiosError === true
  )
}))

vi.mock('axios', () => ({
  default: mockAxios
}))

import { useComfyRegistryService } from './comfyRegistryService'

function response<T>(data: T) {
  return { data }
}

function axiosError(
  message: string,
  responseData?: AxiosLikeError['response']
): AxiosLikeError {
  const error = new Error(message) as AxiosLikeError
  error.isAxiosError = true
  if (responseData) error.response = responseData
  return error
}

describe('useComfyRegistryService', () => {
  beforeEach(() => {
    mockClient.get.mockReset()
    mockClient.post.mockReset()
    mockAxios.isAxiosError.mockClear()
  })

  it('configures the registry axios client with repeated query params', () => {
    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.comfy.org',
      headers: {
        'Content-Type': 'application/json'
      },
      paramsSerializer: {
        indexes: null
      }
    })
  })

  it('returns response data and clears loading state for successful requests', async () => {
    mockClient.get.mockResolvedValueOnce(response({ nodes: [] }))
    const service = useComfyRegistryService()

    const result = await service.search({ search: 'manager' })

    expect(result).toEqual({ nodes: [] })
    expect(mockClient.get).toHaveBeenCalledWith('/nodes/search', {
      params: { search: 'manager' },
      signal: undefined
    })
    expect(service.error.value).toBeNull()
    expect(service.isLoading.value).toBe(false)
  })

  it('skips node definition requests when pack id or version is missing', async () => {
    const service = useComfyRegistryService()

    await expect(
      service.getNodeDefs({ packId: '', version: '1.0.0' })
    ).resolves.toBeNull()
    await expect(
      service.getNodeDefs({ packId: 'pack', version: '' })
    ).resolves.toBeNull()
    expect(mockClient.get).not.toHaveBeenCalled()
  })

  it('passes query params and abort signals through node definition requests', async () => {
    const signal = new AbortController().signal
    mockClient.get.mockResolvedValueOnce(response([{ name: 'KSampler' }]))
    const service = useComfyRegistryService()

    const result = await service.getNodeDefs(
      { packId: 'pack', version: '1.0.0', page: 2 },
      signal
    )

    expect(result).toEqual([{ name: 'KSampler' }])
    expect(mockClient.get).toHaveBeenCalledWith(
      '/nodes/pack/versions/1.0.0/comfy-nodes',
      {
        params: { page: 2 },
        signal
      }
    )
  })

  it('routes publisher, pack, and review methods to their registry endpoints', async () => {
    mockClient.get
      .mockResolvedValueOnce(response({ id: 'publisher' }))
      .mockResolvedValueOnce(response([{ id: 'pack' }]))
      .mockResolvedValueOnce(response([{ version: '1.0.0' }]))
      .mockResolvedValueOnce(response({ id: 'version' }))
      .mockResolvedValueOnce(response({ id: 'pack' }))
      .mockResolvedValueOnce(response({ id: 'pack' }))
      .mockResolvedValueOnce(response({ id: 'pack' }))
    mockClient.post
      .mockResolvedValueOnce(response({ id: 'reviewed' }))
      .mockResolvedValueOnce(response({ node_versions: [] }))
    const service = useComfyRegistryService()
    const signal = new AbortController().signal

    await expect(
      service.getPublisherById('publisher', signal)
    ).resolves.toEqual({ id: 'publisher' })
    await expect(
      service.listPacksForPublisher('publisher', true, signal)
    ).resolves.toEqual([{ id: 'pack' }])
    await expect(
      service.getPackVersions(
        'pack',
        { statuses: ['NodeVersionStatusActive'] },
        signal
      )
    ).resolves.toEqual([{ version: '1.0.0' }])
    await expect(
      service.getPackByVersion('pack', 'version', signal)
    ).resolves.toEqual({ id: 'version' })
    await expect(service.getPackById('pack', signal)).resolves.toEqual({
      id: 'pack'
    })
    await expect(
      service.inferPackFromNodeName('KSampler', signal)
    ).resolves.toEqual({ id: 'pack' })
    await expect(service.listAllPacks({ page: 1 }, signal)).resolves.toEqual({
      id: 'pack'
    })
    await expect(service.postPackReview('pack', 5, signal)).resolves.toEqual({
      id: 'reviewed'
    })
    await expect(
      service.getBulkNodeVersions(
        [{ node_id: 'pack', version: '1.0.0' }],
        signal
      )
    ).resolves.toEqual({ node_versions: [] })

    expect(mockClient.get).toHaveBeenNthCalledWith(1, '/publishers/publisher', {
      signal
    })
    expect(mockClient.get).toHaveBeenNthCalledWith(
      2,
      '/publishers/publisher/nodes',
      {
        params: { include_banned: true },
        signal
      }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(3, '/nodes/pack/versions', {
      params: { statuses: ['NodeVersionStatusActive'] },
      signal
    })
    expect(mockClient.get).toHaveBeenNthCalledWith(
      4,
      '/nodes/pack/versions/version',
      { signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(5, '/nodes/pack', {
      signal
    })
    expect(mockClient.get).toHaveBeenNthCalledWith(
      6,
      '/comfy-nodes/KSampler/node',
      { signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(7, '/nodes', {
      params: { page: 1 },
      signal
    })
    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      '/nodes/pack/reviews',
      null,
      { params: { star: 5 }, signal }
    )
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/bulk/nodes/versions',
      { node_versions: [{ node_id: 'pack', version: '1.0.0' }] },
      { signal }
    )
  })

  it('omits include_banned when listing publisher packs without banned packs', async () => {
    mockClient.get.mockResolvedValueOnce(response([]))
    const service = useComfyRegistryService()

    await service.listPacksForPublisher('publisher', false)

    expect(mockClient.get).toHaveBeenCalledWith('/publishers/publisher/nodes', {
      params: undefined,
      signal: undefined
    })
  })

  it.for([
    { status: 400, expected: 'Bad request: Invalid input' },
    { status: 401, expected: 'Unauthorized: Authentication required' },
    { status: 403, expected: 'Forbidden: Access denied' },
    { status: 404, expected: 'Not found: Resource not found' },
    { status: 409, expected: 'Conflict: Resource conflict' },
    { status: 500, expected: 'Server error: Internal server error' },
    { status: 418, expected: 'Failed to perform search: teapot' }
  ])(
    'normalizes axios response status $status',
    async ({ status, expected }) => {
      mockClient.get.mockRejectedValueOnce(
        axiosError('Request failed', {
          status,
          data: status === 418 ? { message: 'teapot' } : {}
        })
      )
      const service = useComfyRegistryService()

      await expect(service.search()).resolves.toBeNull()

      expect(service.error.value).toBe(expected)
      expect(service.isLoading.value).toBe(false)
    }
  )

  it('uses route-specific errors before generic status messages', async () => {
    mockClient.get.mockRejectedValueOnce(
      axiosError('Request failed', {
        status: 404,
        data: { message: 'ignored' }
      })
    )
    const service = useComfyRegistryService()

    await expect(service.getPackById('missing')).resolves.toBeNull()

    expect(service.error.value).toBe(
      'Pack not found: The pack with ID missing does not exist'
    )
  })

  it('normalizes network, thrown Error, unknown, and abort failures', async () => {
    const service = useComfyRegistryService()

    mockClient.get.mockRejectedValueOnce(axiosError('Network down'))
    await expect(service.search()).resolves.toBeNull()
    expect(service.error.value).toBe('Failed to perform search: Network down')

    mockClient.get.mockRejectedValueOnce(new Error('boom'))
    await expect(service.search()).resolves.toBeNull()
    expect(service.error.value).toBe('Failed to perform search: boom')

    mockClient.get.mockRejectedValueOnce('bad')
    await expect(service.search()).resolves.toBeNull()
    expect(service.error.value).toBe(
      'Failed to perform search: Unknown error occurred'
    )

    mockClient.get.mockRejectedValueOnce(new DOMException('', 'AbortError'))
    await expect(service.search()).resolves.toBeNull()
    expect(service.error.value).toBeNull()
  })
})
