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

  it('interpolates caller input into registry request paths and params', async () => {
    mockClient.get.mockResolvedValue(response({}))
    mockClient.post.mockResolvedValue(response({}))
    const service = useComfyRegistryService()
    const signal = new AbortController().signal

    await service.getPublisherById('pub-42', signal)
    await service.listPacksForPublisher('pub-42', true, signal)
    await service.getPackVersions(
      'pack-7',
      { statuses: ['NodeVersionStatusActive'] },
      signal
    )
    await service.getPackByVersion('pack-7', '2.3.4', signal)
    await service.getPackById('pack-7', signal)
    await service.inferPackFromNodeName('KSampler', signal)
    await service.listAllPacks({ page: 3 }, signal)
    await service.postPackReview('pack-7', 4, signal)
    await service.getBulkNodeVersions(
      [{ node_id: 'pack-7', version: '2.3.4' }],
      signal
    )

    expect(mockClient.get).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pub-42'),
      { signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('pub-42'),
      { params: { include_banned: true }, signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('pack-7'),
      { params: { statuses: ['NodeVersionStatusActive'] }, signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(
      4,
      expect.stringMatching(/pack-7.*2\.3\.4/),
      { signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('pack-7'),
      { signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('KSampler'),
      { signal }
    )
    expect(mockClient.get).toHaveBeenNthCalledWith(7, expect.any(String), {
      params: { page: 3 },
      signal
    })
    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pack-7'),
      null,
      { params: { star: 4 }, signal }
    )
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      { node_versions: [{ node_id: 'pack-7', version: '2.3.4' }] },
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
