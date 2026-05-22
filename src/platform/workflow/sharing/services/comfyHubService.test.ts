import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetchApi = vi.hoisted(() => vi.fn())
const mockGlobalFetch = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
  }
}))

const { useComfyHubService } = await import('./comfyHubService')

function mockJsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response
}

function mockUploadResponse(ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({})
  } as Response
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
})
