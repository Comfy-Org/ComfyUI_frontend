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
    comparisonBeforeFile: null,
    comparisonAfterFile: null,
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

  it('throws when profile username is unavailable', async () => {
    mockProfile.value = null

    const { submitToComfyHub } = useComfyHubPublishSubmission()
    await expect(submitToComfyHub(createFormData())).rejects.toThrow(
      'ComfyHub profile is required before publishing'
    )
  })
})
