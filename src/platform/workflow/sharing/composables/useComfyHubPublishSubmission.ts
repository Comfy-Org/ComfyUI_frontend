import type { AssetInfo, ComfyHubProfile } from '@/schemas/apiSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import { useComfyHubService } from '@/platform/workflow/sharing/services/comfyHubService'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import type {
  ComfyHubApiThumbnailType,
  ComfyHubPublishFormData,
  ThumbnailType
} from '@/platform/workflow/sharing/types/comfyHubTypes'

function mapThumbnailType(type: ThumbnailType): ComfyHubApiThumbnailType {
  if (type === 'imageComparison') {
    return 'image_comparison'
  }

  return type
}

function getFileContentType(file: File): string {
  return file.type || 'application/octet-stream'
}

function getSelectedExampleFiles(formData: ComfyHubPublishFormData): File[] {
  const selectedImageIds = new Set(formData.selectedExampleIds)
  return formData.exampleImages
    .filter((image) => selectedImageIds.has(image.id))
    .map((image) => image.file)
    .filter((file): file is File => Boolean(file))
}

function getUsername(profile: ComfyHubProfile | null): string {
  const username = profile?.username?.trim()
  if (!username) {
    throw new Error('ComfyHub profile is required before publishing')
  }

  return username
}

function getWorkflowFilename(path: string | null | undefined): string {
  const workflowFilename = path?.trim()
  if (!workflowFilename) {
    throw new Error('No active workflow file available for publishing')
  }

  return workflowFilename
}

function getAssetIds(assets: AssetInfo[]): string[] {
  return assets.map((asset) => asset.id)
}

export function useComfyHubPublishSubmission() {
  const { profile } = useComfyHubProfileGate()
  const { activeWorkflow } = useWorkflowStore()
  const workflowShareService = useWorkflowShareService()
  const comfyHubService = useComfyHubService()

  async function uploadFileAndGetToken(file: File): Promise<string> {
    const contentType = getFileContentType(file)
    const upload = await comfyHubService.requestAssetUploadUrl({
      filename: file.name,
      contentType
    })

    await comfyHubService.uploadFileToPresignedUrl({
      uploadUrl: upload.uploadUrl,
      file,
      contentType
    })

    return upload.token
  }

  async function submitToComfyHub(
    formData: ComfyHubPublishFormData
  ): Promise<void> {
    const username = getUsername(profile.value)
    const workflowFilename = getWorkflowFilename(activeWorkflow?.path)
    const assetIds = getAssetIds(
      await workflowShareService.getShareableAssets()
    )

    const thumbnailType = mapThumbnailType(formData.thumbnailType)
    const thumbnailTokenOrUrl =
      formData.thumbnailFile && thumbnailType !== 'image_comparison'
        ? await uploadFileAndGetToken(formData.thumbnailFile)
        : formData.comparisonBeforeFile
          ? await uploadFileAndGetToken(formData.comparisonBeforeFile)
          : undefined
    const thumbnailComparisonTokenOrUrl =
      thumbnailType === 'image_comparison' && formData.comparisonAfterFile
        ? await uploadFileAndGetToken(formData.comparisonAfterFile)
        : undefined

    const selectedSampleFiles = getSelectedExampleFiles(formData)
    const sampleImageTokensOrUrls =
      selectedSampleFiles.length > 0
        ? await Promise.all(
            selectedSampleFiles.map((file) => uploadFileAndGetToken(file))
          )
        : undefined

    await comfyHubService.publishWorkflow({
      username,
      name: formData.name,
      workflowFilename,
      assetIds,
      description: formData.description || undefined,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      thumbnailType,
      thumbnailTokenOrUrl,
      thumbnailComparisonTokenOrUrl,
      sampleImageTokensOrUrls
    })
  }

  return {
    submitToComfyHub
  }
}
