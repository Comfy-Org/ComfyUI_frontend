import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetchApi = vi.hoisted(() => vi.fn())
const mockGlobalFetch = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
  }
}))

const { useComfyHubService } = await import('./comfyHubService')

function mockJsonResponse(
  payload: unknown,
  _ok = true,
  status = 200
): Response {
  return new Response(JSON.stringify(payload), { status })
}

function mockUploadResponse(_ok = true, status = 200): Response {
  return new Response(JSON.stringify({}), { status })
}

function mockJsonFailure(_ok = false, status = 500): Response {
  return new Response('not valid json', { status })
}

describe('useComfyHubService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', mockGlobalFetch)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('requests upload url and returns token payload', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        upload_url: 'https://upload.example.com/object',
        public_url: 'https://cdn.example.com/object',
        token: 'upload-token'
      })
    )

    const service = useComfyHubService()
    const result = await service.requestAssetUploadUrl({
      filename: 'thumb.png',
      contentType: 'image/png'
    })

    expect(mockFetchApi).toHaveBeenCalledWith('/hub/assets/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'thumb.png',
        content_type: 'image/png'
      })
    })
    expect(result).toEqual({
      uploadUrl: 'https://upload.example.com/object',
      publicUrl: 'https://cdn.example.com/object',
      token: 'upload-token'
    })
  })

  it('uploads file to presigned url with PUT', async () => {
    mockGlobalFetch.mockResolvedValue(mockUploadResponse())

    const service = useComfyHubService()
    const file = new File(['payload'], 'avatar.png', { type: 'image/png' })
    await service.uploadFileToPresignedUrl({
      uploadUrl: 'https://upload.example.com/object',
      file,
      contentType: 'image/png'
    })

    expect(mockGlobalFetch).toHaveBeenCalledWith(
      'https://upload.example.com/object',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png'
        },
        body: file
      }
    )
  })

  it('creates profile with workspace_id JSON body', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        id: 'profile-1',
        username: 'builder',
        display_name: 'Builder',
        description: 'Builds workflows',
        avatar_url: 'https://cdn.example.com/avatar.png',
        website_urls: []
      })
    )

    const service = useComfyHubService()
    const profile = await service.createProfile({
      workspaceId: 'workspace-1',
      username: 'builder',
      displayName: 'Builder',
      description: 'Builds workflows',
      avatarToken: 'avatar-token'
    })

    expect(mockFetchApi).toHaveBeenCalledWith('/hub/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'workspace-1',
        username: 'builder',
        display_name: 'Builder',
        description: 'Builds workflows',
        avatar_token: 'avatar-token'
      })
    })
    expect(profile).toEqual({
      username: 'builder',
      name: 'Builder',
      description: 'Builds workflows',
      profilePictureUrl: 'https://cdn.example.com/avatar.png',
      coverImageUrl: undefined
    })
  })

  it('publishes workflow with mapped thumbnail enum', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_id: 'share-1',
        workflow_id: 'workflow-1',
        thumbnail_type: 'image_comparison'
      })
    )

    const service = useComfyHubService()
    await service.publishWorkflow({
      username: 'builder',
      name: 'My Flow',
      workflowFilename: 'workflows/my-flow.json',
      assetIds: ['asset-1'],
      thumbnailType: 'imageComparison',
      thumbnailTokenOrUrl: 'thumb-token',
      thumbnailComparisonTokenOrUrl: 'thumb-compare-token',
      sampleImageTokensOrUrls: ['sample-1']
    })

    const [, options] = mockFetchApi.mock.calls[0]
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({
      username: 'builder',
      name: 'My Flow',
      workflow_filename: 'workflows/my-flow.json',
      asset_ids: ['asset-1'],
      thumbnail_type: 'image_comparison',
      thumbnail_token_or_url: 'thumb-token',
      thumbnail_comparison_token_or_url: 'thumb-compare-token',
      sample_image_tokens_or_urls: ['sample-1']
    })
    expect(mockFetchApi).toHaveBeenCalledWith('/hub/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  })

  it('publishes workflow with hub-native thumbnail type', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        share_id: 'share-1',
        workflow_id: 'workflow-1',
        thumbnail_type: 'video'
      })
    )

    const service = useComfyHubService()
    await service.publishWorkflow({
      username: 'builder',
      name: 'Video Flow',
      workflowFilename: 'workflows/video-flow.json',
      assetIds: ['asset-1'],
      thumbnailType: 'video'
    })

    const [, options] = mockFetchApi.mock.calls[0]
    const body = JSON.parse(options.body as string)
    expect(body.thumbnail_type).toBe('video')
  })

  it('fetches tag labels from /hub/labels?type=tag', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        labels: [
          { name: 'video', display_name: 'Video', type: 'tag' },
          { name: 'text-to-image', display_name: 'Text to Image', type: 'tag' }
        ]
      })
    )

    const service = useComfyHubService()
    const tags = await service.fetchTagLabels()

    expect(mockFetchApi).toHaveBeenCalledWith('/hub/labels?type=tag')
    expect(tags).toEqual(['Video', 'Text to Image'])
  })

  it('fetches current profile from /hub/profiles/me', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({
        id: 'profile-1',
        username: 'builder',
        display_name: 'Builder',
        description: 'Builds workflows',
        avatar_url: 'https://cdn.example.com/avatar.png',
        website_urls: []
      })
    )

    const service = useComfyHubService()
    const profile = await service.getMyProfile()

    expect(mockFetchApi).toHaveBeenCalledWith('/hub/profiles/me')
    expect(profile).toEqual({
      username: 'builder',
      name: 'Builder',
      description: 'Builds workflows',
      profilePictureUrl: 'https://cdn.example.com/avatar.png',
      coverImageUrl: undefined
    })
  })

  it('returns null when current profile is missing', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({}, false, 404))

    const service = useComfyHubService()

    await expect(service.getMyProfile()).resolves.toBeNull()
  })

  it('uses server error messages when requests fail', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({ message: 'No upload for you' }, false, 400)
    )

    const service = useComfyHubService()

    await expect(
      service.requestAssetUploadUrl({
        filename: 'thumb.png',
        contentType: 'image/png'
      })
    ).rejects.toThrow('No upload for you')
  })

  it('uses fallback error messages when error bodies are missing or malformed', async () => {
    mockFetchApi.mockResolvedValueOnce(mockJsonFailure())
    const service = useComfyHubService()

    await expect(
      service.requestAssetUploadUrl({
        filename: 'thumb.png',
        contentType: 'image/png'
      })
    ).rejects.toThrow('Failed to request upload URL')

    mockFetchApi.mockResolvedValueOnce(mockJsonResponse({}, false, 500))

    await expect(service.getMyProfile()).rejects.toThrow(
      'Failed to load ComfyHub profile'
    )
  })

  it('throws on invalid success payloads', async () => {
    mockFetchApi.mockResolvedValue(mockJsonResponse({ invalid: true }))

    const service = useComfyHubService()

    await expect(service.fetchTagLabels()).rejects.toThrow(
      'Invalid label list response from server'
    )
  })

  it('throws upload errors from presigned URL uploads', async () => {
    mockGlobalFetch.mockResolvedValue(
      mockJsonResponse({ message: 'Upload rejected' }, false, 403)
    )

    const service = useComfyHubService()
    const file = new File(['payload'], 'avatar.png', { type: 'image/png' })

    await expect(
      service.uploadFileToPresignedUrl({
        uploadUrl: 'https://upload.example.com/object',
        file,
        contentType: 'image/png'
      })
    ).rejects.toThrow('Upload rejected')
  })

  it('throws create and publish failures with parsed fallback messages', async () => {
    const service = useComfyHubService()
    mockFetchApi.mockResolvedValueOnce(mockJsonResponse({}, false, 500))

    await expect(
      service.createProfile({
        workspaceId: 'workspace-1',
        username: 'builder'
      })
    ).rejects.toThrow('Failed to create ComfyHub profile')

    mockFetchApi.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Publish rejected' }, false, 400)
    )

    await expect(
      service.publishWorkflow({
        username: 'builder',
        name: 'My Flow',
        workflowFilename: 'workflows/my-flow.json',
        assetIds: ['asset-1']
      })
    ).rejects.toThrow('Publish rejected')
  })

  it('throws label fetch failures', async () => {
    mockFetchApi.mockResolvedValue(
      mockJsonResponse({ message: 'Labels unavailable' }, false, 503)
    )

    const service = useComfyHubService()

    await expect(service.fetchTagLabels()).rejects.toThrow('Labels unavailable')
  })
})
