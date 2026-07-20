import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyHubProfile } from '@/schemas/apiSchema'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'

const mockGetShareableAssets = vi.hoisted(() => vi.fn())
const mockRequestAssetUploadUrl = vi.hoisted(() => vi.fn())
const mockUploadFileToPresignedUrl = vi.hoisted(() => vi.fn())
const mockPublishWorkflow = vi.hoisted(() => vi.fn())
const mockProfile = vi.hoisted(
  () => ({ value: null }) as { value: ComfyHubProfile | null }
)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      profile: mockProfile
    })
  })
)

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getShareableAssets: mockGetShareableAssets
  })
}))

vi.mock('@/platform/workflow/sharing/services/comfyHubService', () => ({
  useComfyHubService: () => ({
    requestAssetUploadUrl: mockRequestAssetUploadUrl,
    uploadFileToPresignedUrl: mockUploadFileToPresignedUrl,
    publishWorkflow: mockPublishWorkflow
  })
}))

const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: {
    path: 'workflows/demo-workflow.json'
  }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

const { useComfyHubPublishSubmission } =
  await import('./useComfyHubPublishSubmission')

function createFormData(
  overrides: Partial<ComfyHubPublishFormData> = {}
): ComfyHubPublishFormData {
  return {
    name: 'Demo workflow',
    description: 'A demo workflow',
    tags: ['demo'],
    models: [],
    customNodes: [],
    thumbnailType: 'image',
    thumbnailFile: null,
    thumbnailUrl: null,
    existingThumbnailType: null,
    comparisonBeforeFile: null,
    comparisonAfterFile: null,
    comparisonAfterUrl: null,
    exampleImages: [],
    tutorialUrl: '',
    metadata: {},
    ...overrides
  }
}

describe('useComfyHubPublishSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfile.value = {
      username: 'builder',
      name: 'Builder'
    }
    mockGetShareableAssets.mockResolvedValue([
      { id: 'asset-1' },
      { id: 'asset-2' }
    ])

    let uploadIndex = 0
    mockRequestAssetUploadUrl.mockImplementation(
      async ({ filename }: { filename: string }) => {
        uploadIndex += 1
        return {
          uploadUrl: `https://upload.example.com/${filename}`,
          publicUrl: `https://cdn.example.com/${filename}`,
          token: `token-${uploadIndex}`
        }
      }
    )
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined)
    mockPublishWorkflow.mockResolvedValue({
      share_id: 'share-1',
      workflow_id: 'workflow-1'
    })
  })

  it('passes imageComparison thumbnail type to service for normalization', async () => {
    const beforeFile = new File(['before'], 'before.png', { type: 'image/png' })
    const afterFile = new File(['after'], 'after.png', { type: 'image/png' })

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'imageComparison',
        thumbnailFile: null,
        comparisonBeforeFile: beforeFile,
        comparisonAfterFile: afterFile
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailType: 'imageComparison'
      })
    )
  })

  it('uploads thumbnail and returns thumbnail token', async () => {
    const thumbnailFile = new File(['thumbnail'], 'thumb.png', {
      type: 'image/png'
    })

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'image',
        thumbnailFile
      })
    )

    expect(mockRequestAssetUploadUrl).toHaveBeenCalledWith({
      filename: 'thumb.png',
      contentType: 'image/png'
    })
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalledWith({
      uploadUrl: 'https://upload.example.com/thumb.png',
      file: thumbnailFile,
      contentType: 'image/png'
    })
    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailTokenOrUrl: 'token-1'
      })
    )
  })

  it('uses octet-stream content type when file type is missing', async () => {
    const thumbnailFile = new File(['thumbnail'], 'thumb.bin')

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'image',
        thumbnailFile
      })
    )

    expect(mockRequestAssetUploadUrl).toHaveBeenCalledWith({
      filename: 'thumb.bin',
      contentType: 'application/octet-stream'
    })
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/octet-stream'
      })
    )
  })

  it('sends the existing thumbnail URL when no new file is attached', async () => {
    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'image',
        thumbnailFile: null,
        thumbnailUrl: 'https://cdn.example.com/existing-thumb.png',
        existingThumbnailType: 'image'
      })
    )

    expect(mockRequestAssetUploadUrl).not.toHaveBeenCalled()
    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailTokenOrUrl: 'https://cdn.example.com/existing-thumb.png'
      })
    )
  })

  it('sends the existing comparison URLs when no new files are attached', async () => {
    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'imageComparison',
        thumbnailFile: null,
        comparisonBeforeFile: null,
        comparisonAfterFile: null,
        thumbnailUrl: 'https://cdn.example.com/before.png',
        comparisonAfterUrl: 'https://cdn.example.com/after.png',
        existingThumbnailType: 'imageComparison'
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailTokenOrUrl: 'https://cdn.example.com/before.png',
        thumbnailComparisonTokenOrUrl: 'https://cdn.example.com/after.png'
      })
    )
  })

  it('does not submit an existing thumbnail URL after the type is switched away', async () => {
    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'video',
        thumbnailFile: null,
        thumbnailUrl: 'https://cdn.example.com/existing-image.png',
        existingThumbnailType: 'image'
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailType: 'video',
        thumbnailTokenOrUrl: undefined
      })
    )
  })

  it('prefers a newly uploaded thumbnail file over the existing URL', async () => {
    const thumbnailFile = new File(['thumbnail'], 'new-thumb.png', {
      type: 'image/png'
    })

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'image',
        thumbnailFile,
        thumbnailUrl: 'https://cdn.example.com/existing-thumb.png',
        existingThumbnailType: 'image'
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailTokenOrUrl: 'token-1'
      })
    )
  })

  it('prefers a newly uploaded comparison-after file over the existing URL', async () => {
    const afterFile = new File(['after'], 'after.png', { type: 'image/png' })

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'imageComparison',
        comparisonBeforeFile: null,
        comparisonAfterFile: afterFile,
        thumbnailUrl: 'https://cdn.example.com/before.png',
        comparisonAfterUrl: 'https://cdn.example.com/after.png',
        existingThumbnailType: 'imageComparison'
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailComparisonTokenOrUrl: 'token-1'
      })
    )
  })

  it('uploads all example images', async () => {
    const file1 = new File(['img1'], 'img1.png', { type: 'image/png' })
    const file2 = new File(['img2'], 'img2.png', { type: 'image/png' })

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        thumbnailType: 'image',
        thumbnailFile: null,
        exampleImages: [
          { id: 'a', file: file1, url: 'blob:a' },
          { id: 'b', file: file2, url: 'blob:b' }
        ]
      })
    )

    expect(mockRequestAssetUploadUrl).toHaveBeenCalledTimes(2)
    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleImageTokensOrUrls: ['token-1', 'token-2']
      })
    )
  })

  it('keeps existing example image URLs without uploading them', async () => {
    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        exampleImages: [
          {
            id: 'existing',
            url: 'https://cdn.example.com/existing.png'
          }
        ]
      })
    )

    expect(mockRequestAssetUploadUrl).not.toHaveBeenCalled()
    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleImageTokensOrUrls: ['https://cdn.example.com/existing.png']
      })
    )
  })

  it('builds publish request with workflow filename + asset ids', async () => {
    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(createFormData())

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'builder',
        workflowFilename: 'workflows/demo-workflow.json',
        assetIds: ['asset-1', 'asset-2'],
        name: 'Demo workflow',
        description: 'A demo workflow',
        tags: ['demo']
      })
    )
  })

  it('omits optional publish fields when form values are empty', async () => {
    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        description: '',
        tags: [],
        models: [],
        customNodes: [],
        tutorialUrl: '',
        metadata: {}
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        description: undefined,
        tags: undefined,
        models: undefined,
        customNodes: undefined,
        tutorialUrl: undefined,
        metadata: undefined
      })
    )
  })

  it('passes optional publish fields when form values are present', async () => {
    const metadata = { license: 'cc-by' }
    const models = ['model']
    const customNodes = ['custom-node']

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(
      createFormData({
        models,
        customNodes,
        tutorialUrl: 'https://example.com/tutorial',
        metadata
      })
    )

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        models,
        customNodes,
        tutorialUrl: 'https://example.com/tutorial',
        metadata
      })
    )
  })

  it('trims the profile username before publishing', async () => {
    mockProfile.value = {
      username: ' builder ',
      name: 'Builder'
    }

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await submitToComfyHub(createFormData())

    expect(mockPublishWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'builder'
      })
    )
  })

  it('throws when profile username is unavailable', async () => {
    mockProfile.value = null

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await expect(submitToComfyHub(createFormData())).rejects.toThrow(
      'ComfyHub profile is required before publishing'
    )
  })

  it('throws when active workflow path is unavailable', async () => {
    mockWorkflowStore.activeWorkflow.path = '   '

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await expect(submitToComfyHub(createFormData())).rejects.toThrow(
      'No active workflow file available for publishing'
    )
  })
})
