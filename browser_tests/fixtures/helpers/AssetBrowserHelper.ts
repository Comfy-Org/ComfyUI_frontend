import type { Page, Route } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'

export type TagMutationCall = {
  method: string
  assetId: string
  body: { tags: string[] }
  timestamp: number
}

const modelFoldersRoutePattern = /\/api\/experiment\/models(?:\?.*)?$/
const assetTagsRoutePattern = /\/api\/assets\/([^/]+)\/tags(?:\?.*)?$/

export class AssetBrowserHelper {
  private readonly routeHandlers: Array<{
    pattern: string | RegExp
    handler: (route: Route) => Promise<void>
  }> = []

  constructor(private readonly page: Page) {}

  async mockModelFolders(
    folders: Array<{ name: string; folders: string[] }>
  ): Promise<void> {
    const handler = async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(folders)
      })
    }

    this.routeHandlers.push({ pattern: modelFoldersRoutePattern, handler })
    await this.page.route(modelFoldersRoutePattern, handler)
  }

  async mockAssetTags(
    initialAssets?: Array<{ id: string; tags: string[] }>
  ): Promise<{ getCalls(): TagMutationCall[] }> {
    const calls: TagMutationCall[] = []
    const tagsByAssetId = new Map<string, string[]>()

    if (initialAssets) {
      for (const asset of initialAssets) {
        tagsByAssetId.set(asset.id, [...asset.tags])
      }
    }

    const handler = async (route: Route) => {
      const request = route.request()
      const method = request.method()
      if (method !== 'POST' && method !== 'DELETE') {
        await route.fallback()
        return
      }

      const match = request.url().match(assetTagsRoutePattern)
      const assetId = match?.[1]
      if (!assetId) {
        await route.fallback()
        return
      }

      const rawBody = request.postDataJSON() as { tags?: unknown }
      const tags = Array.isArray(rawBody?.tags)
        ? rawBody.tags.filter((tag): tag is string => typeof tag === 'string')
        : []

      const body = { tags }
      calls.push({
        method,
        assetId,
        body,
        timestamp: Date.now()
      })

      const existing = tagsByAssetId.get(assetId) ?? ['models']
      const totalTags =
        method === 'POST'
          ? Array.from(new Set([...existing, ...tags]))
          : existing.filter((tag) => !tags.includes(tag))

      const added =
        method === 'POST'
          ? totalTags.filter((tag) => !existing.includes(tag))
          : []
      const removed =
        method === 'DELETE'
          ? existing.filter((tag) => !totalTags.includes(tag))
          : []

      tagsByAssetId.set(assetId, totalTags)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_tags: totalTags,
          added,
          removed
        })
      })
    }

    this.routeHandlers.push({ pattern: assetTagsRoutePattern, handler })
    await this.page.route(assetTagsRoutePattern, handler)

    return {
      getCalls: () => [...calls]
    }
  }

  async enableAssetApiSetting(): Promise<void> {
    await this.page.evaluate(async () => {
      await window.app!.extensionManager.setting.set(
        'Comfy.Assets.UseAssetAPI',
        true
      )
    })
  }

  async openModelLibrary(): Promise<void> {
    await this.page.evaluate(async () => {
      await window.app!.extensionManager.command.execute(
        'Comfy.BrowseModelAssets'
      )
    })
  }

  async clearMocks(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
  }
}

export function assetToDisplayName(asset: Asset): string {
  if (typeof asset.user_metadata?.name === 'string') {
    return asset.user_metadata.name
  }
  if (typeof asset.metadata?.name === 'string') {
    return asset.metadata.name
  }
  return asset.name
}
