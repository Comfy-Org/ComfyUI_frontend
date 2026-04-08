import type { Page, Route } from '@playwright/test'

import type {
  AssetInfo,
  HubAssetUploadUrlResponse,
  HubLabelInfo,
  HubLabelListResponse,
  HubProfile,
  WorkflowPublishInfo
} from '@comfyorg/ingest-types'

import type { ShareableAssetsResponse } from '@/schemas/apiSchema'

const DEFAULT_PROFILE: HubProfile = {
  username: 'testuser',
  display_name: 'Test User',
  description: 'A test creator',
  avatar_url: undefined
}

const DEFAULT_TAG_LABELS: HubLabelInfo[] = [
  { name: 'anime', display_name: 'anime', type: 'tag' },
  { name: 'upscale', display_name: 'upscale', type: 'tag' },
  { name: 'faceswap', display_name: 'faceswap', type: 'tag' },
  { name: 'img2img', display_name: 'img2img', type: 'tag' },
  { name: 'controlnet', display_name: 'controlnet', type: 'tag' }
]

const DEFAULT_PUBLISH_RESPONSE: WorkflowPublishInfo = {
  workflow_id: 'test-workflow-id-456',
  share_id: 'test-share-id-123',
  publish_time: new Date().toISOString(),
  listed: true,
  assets: []
}

const DEFAULT_UPLOAD_URL_RESPONSE: HubAssetUploadUrlResponse = {
  upload_url: 'https://mock-s3.example.com/upload',
  public_url: 'https://mock-s3.example.com/asset.png',
  token: 'mock-upload-token'
}

export class PublishApiHelper {
  private routeHandlers: Array<{
    pattern: string
    handler: (route: Route) => Promise<void>
  }> = []

  constructor(private readonly page: Page) {}

  async mockProfile(profile: HubProfile | null): Promise<void> {
    await this.addRoute('**/hub/profiles/me', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      if (profile === null) {
        await route.fulfill({ status: 404, body: 'Not found' })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(profile)
        })
      }
    })
  }

  async mockTagLabels(
    labels: HubLabelInfo[] = DEFAULT_TAG_LABELS
  ): Promise<void> {
    const response: HubLabelListResponse = { labels }
    await this.addRoute('**/hub/labels**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })
  }

  async mockPublishStatus(
    status: 'unpublished' | WorkflowPublishInfo
  ): Promise<void> {
    await this.addRoute('**/userdata/*/publish', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      if (status === 'unpublished') {
        await route.fulfill({ status: 404, body: 'Not found' })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(status)
        })
      }
    })
  }

  async mockShareableAssets(assets: AssetInfo[] = []): Promise<void> {
    const response: ShareableAssetsResponse = { assets }
    await this.addRoute('**/assets/from-workflow', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })
  }

  async mockPublishWorkflow(
    response: WorkflowPublishInfo = DEFAULT_PUBLISH_RESPONSE
  ): Promise<void> {
    await this.removeRoutes('**/hub/workflows')
    await this.addRoute('**/hub/workflows', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })
  }

  async mockPublishWorkflowError(
    statusCode = 500,
    message = 'Failed to publish workflow'
  ): Promise<void> {
    await this.removeRoutes('**/hub/workflows')
    await this.addRoute('**/hub/workflows', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ message })
      })
    })
  }

  async mockUploadUrl(
    response: HubAssetUploadUrlResponse = DEFAULT_UPLOAD_URL_RESPONSE
  ): Promise<void> {
    await this.addRoute('**/hub/assets/upload-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })
  }

  async setupDefaultMocks(options?: {
    hasProfile?: boolean
    hasPrivateAssets?: boolean
  }): Promise<void> {
    const { hasProfile = true, hasPrivateAssets = false } = options ?? {}

    await this.mockProfile(hasProfile ? DEFAULT_PROFILE : null)
    await this.mockTagLabels()
    await this.mockPublishStatus('unpublished')
    await this.mockShareableAssets(
      hasPrivateAssets
        ? [
            {
              id: 'asset-1',
              name: 'my_model.safetensors',
              preview_url: '',
              storage_url: '',
              model: true,
              public: false,
              in_library: true
            }
          ]
        : []
    )
    await this.mockPublishWorkflow()
    await this.mockUploadUrl()
  }

  async cleanup(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
    this.routeHandlers = []
  }

  private async addRoute(
    pattern: string,
    handler: (route: Route) => Promise<void>
  ): Promise<void> {
    this.routeHandlers.push({ pattern, handler })
    await this.page.route(pattern, handler)
  }

  private async removeRoutes(pattern: string): Promise<void> {
    const handlers = this.routeHandlers.filter(
      (route) => route.pattern === pattern
    )
    for (const { handler } of handlers) {
      await this.page.unroute(pattern, handler)
    }
    this.routeHandlers = this.routeHandlers.filter(
      (route) => route.pattern !== pattern
    )
  }
}
