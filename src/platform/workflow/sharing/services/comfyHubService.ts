import type { ComfyHubProfile } from '@/schemas/apiSchema'
import {
  zHubAssetUploadUrlResponse,
  zHubLabelListResponse,
  zHubProfileResponse,
  zHubWorkflowPublishResponse
} from '@/platform/workflow/sharing/schemas/shareSchemas'
import { api } from '@/scripts/api'

type HubThumbnailType = 'image' | 'video' | 'image_comparison'

type ThumbnailTypeInput = HubThumbnailType | 'imageComparison'

interface CreateProfileInput {
  workspaceId: string
  username: string
  displayName?: string
  description?: string
  avatarToken?: string
}

interface PublishWorkflowInput {
  username: string
  name: string
  workflowFilename: string
  assetIds: string[]
  description?: string
  tags?: string[]
  models?: string[]
  customNodes?: string[]
  thumbnailType?: ThumbnailTypeInput
  thumbnailTokenOrUrl?: string
  thumbnailComparisonTokenOrUrl?: string
  sampleImageTokensOrUrls?: string[]
  tutorialUrl?: string
  metadata?: Record<string, unknown>
}

function normalizeThumbnailType(type: ThumbnailTypeInput): HubThumbnailType {
  if (type === 'imageComparison') {
    return 'image_comparison'
  }

  return type
}

async function parseErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const body = await response.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return fallbackMessage
  }

  if ('message' in body && typeof body.message === 'string') {
    return body.message
  }

  return fallbackMessage
}

async function parseRequiredJson<T>(
  response: Response,
  parser: {
    safeParse: (
      value: unknown
    ) => { success: true; data: T } | { success: false }
  },
  fallbackMessage: string
): Promise<T> {
  const payload = await response.json().catch(() => null)
  const parsed = parser.safeParse(payload)
  if (!parsed.success) {
    throw new Error(fallbackMessage)
  }

  return parsed.data
}

export function useComfyHubService() {
  async function requestAssetUploadUrl(input: {
    filename: string
    contentType: string
  }) {
    const response = await api.fetchApi('/hub/assets/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: input.filename,
        content_type: input.contentType
      })
    })

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, 'Failed to request upload URL')
      )
    }

    return parseRequiredJson(
      response,
      zHubAssetUploadUrlResponse,
      'Invalid upload URL response from server'
    )
  }

  async function uploadFileToPresignedUrl(input: {
    uploadUrl: string
    file: File
    contentType: string
  }): Promise<void> {
    const response = await fetch(input.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': input.contentType
      },
      body: input.file
    })

    if (!response.ok) {
      const message = await parseErrorMessage(
        response,
        'Failed to upload file to presigned URL'
      )
      throw new Error(message)
    }
  }

  async function getMyProfile(): Promise<ComfyHubProfile | null> {
    const response = await api.fetchApi('/hub/profiles/me')

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }

      throw new Error(
        await parseErrorMessage(response, 'Failed to load ComfyHub profile')
      )
    }

    return parseRequiredJson(
      response,
      zHubProfileResponse,
      'Invalid profile response from server'
    )
  }

  async function createProfile(
    input: CreateProfileInput
  ): Promise<ComfyHubProfile> {
    const response = await api.fetchApi('/hub/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        username: input.username,
        display_name: input.displayName,
        description: input.description,
        avatar_token: input.avatarToken
      })
    })

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, 'Failed to create ComfyHub profile')
      )
    }

    return parseRequiredJson(
      response,
      zHubProfileResponse,
      'Invalid profile response from server'
    )
  }

  async function publishWorkflow(input: PublishWorkflowInput) {
    const body = {
      username: input.username,
      name: input.name,
      workflow_filename: input.workflowFilename,
      asset_ids: input.assetIds,
      description: input.description,
      tags: input.tags,
      models: input.models,
      custom_nodes: input.customNodes,
      thumbnail_type: input.thumbnailType
        ? normalizeThumbnailType(input.thumbnailType)
        : undefined,
      thumbnail_token_or_url: input.thumbnailTokenOrUrl,
      thumbnail_comparison_token_or_url: input.thumbnailComparisonTokenOrUrl,
      sample_image_tokens_or_urls: input.sampleImageTokensOrUrls,
      tutorial_url: input.tutorialUrl,
      metadata: input.metadata
    }

    const response = await api.fetchApi('/hub/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, 'Failed to publish workflow')
      )
    }

    return parseRequiredJson(
      response,
      zHubWorkflowPublishResponse,
      'Invalid publish response from server'
    )
  }

  async function fetchTagLabels(): Promise<string[]> {
    const response = await api.fetchApi('/hub/labels?type=tag')

    if (!response.ok) {
      throw new Error(
        await parseErrorMessage(response, 'Failed to fetch hub labels')
      )
    }

    const data = await parseRequiredJson(
      response,
      zHubLabelListResponse,
      'Invalid label list response from server'
    )

    return data.labels.map((label) => label.display_name)
  }

  return {
    requestAssetUploadUrl,
    uploadFileToPresignedUrl,
    getMyProfile,
    createProfile,
    publishWorkflow,
    fetchTagLabels
  }
}
