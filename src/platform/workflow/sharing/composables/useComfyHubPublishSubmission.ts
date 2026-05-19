import type { AssetInfo, ComfyHubProfile } from '@/schemas/apiSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import { useComfyHubService } from '@/platform/workflow/sharing/services/comfyHubService'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { normalizeTags } from '@/platform/workflow/sharing/utils/normalizeTags'

function getFileContentType(file: File): string {
  return file.type || 'application/octet-stream'
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

interface ThumbnailSource {
  file: File | null
  url: string | null
}

function resolveThumbnailSource(
  formData: ComfyHubPublishFormData
): ThumbnailSource {
  if (formData.thumbnailType === 'imageComparison') {
    return {
      file: formData.comparisonBeforeFile,
      url: formData.comparisonBeforeUrl
    }
  }
  return {
    file: formData.thumbnailFile,
    url: formData.thumbnailUrl
  }
}

export function useComfyHubPublishSubmission() {
  const { profile } = useComfyHubProfileGate()
  const workflowStore = useWorkflowStore()
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
    const workflowFilename = getWorkflowFilename(
      workflowStore.activeWorkflow?.path
    )
    const assetIds = getAssetIds(
      await workflowShareService.getShareableAssets()
    )

    const thumbnail = resolveThumbnailSource(formData)
    const thumbnailTokenOrUrl = thumbnail.file
      ? await uploadFileAndGetToken(thumbnail.file)
      : (thumbnail.url ?? undefined)
    const thumbnailComparisonTokenOrUrl =
      formData.thumbnailType === 'imageComparison'
        ? formData.comparisonAfterFile
          ? await uploadFileAndGetToken(formData.comparisonAfterFile)
          : (formData.comparisonAfterUrl ?? undefined)
        : undefined

    const sampleImageTokensOrUrls =
      formData.exampleImages.length > 0
        ? await Promise.all(
            formData.exampleImages.map((image) =>
              image.file ? uploadFileAndGetToken(image.file) : image.url
            )
          )
        : undefined

    await comfyHubService.publishWorkflow({
      username,
      name: formData.name,
      workflowFilename,
      assetIds,
      description: formData.description || undefined,
      tags: formData.tags.length > 0 ? normalizeTags(formData.tags) : undefined,
      models: formData.models.length > 0 ? formData.models : undefined,
      customNodes:
        formData.customNodes.length > 0 ? formData.customNodes : undefined,
      thumbnailType: formData.thumbnailType,
      thumbnailTokenOrUrl,
      thumbnailComparisonTokenOrUrl,
      sampleImageTokensOrUrls,
      tutorialUrl: formData.tutorialUrl || undefined,
      metadata:
        Object.keys(formData.metadata).length > 0
          ? formData.metadata
          : undefined
    })
  }

  return {
    submitToComfyHub
  }
}
