import type { Page, Route } from '@playwright/test'

export type TagMutationCall = {
  method: string
  assetId: string
  body: { tags: string[] }
}

const assetTagsRoutePattern = /\/api\/assets\/([^/]+)\/tags(?:\?.*)?$/

export class AssetBrowserHelper {
  private readonly routeHandlers: Array<{
    pattern: string | RegExp
    handler: (route: Route) => Promise<void>
  }> = []

  constructor(private readonly page: Page) {}

  /** Register before `comfyPage.setup()` so startup requests use this mock. */
  async mockAssetTags(): Promise<{ getCalls(): TagMutationCall[] }> {
    const calls: TagMutationCall[] = []

    const handler = async (route: Route) => {
      const request = route.request()
      const method = request.method()
      if (method !== 'POST' && method !== 'DELETE') {
        await route.fallback()
        return
      }

      const assetId = request.url().match(assetTagsRoutePattern)?.[1]
      if (!assetId) {
        await route.fallback()
        return
      }

      const rawBody = request.postDataJSON() as { tags?: unknown } | null
      const tags = Array.isArray(rawBody?.tags)
        ? rawBody.tags.filter((tag): tag is string => typeof tag === 'string')
        : []

      const body = { tags }
      calls.push({
        method,
        assetId,
        body
      })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_tags: tags })
      })
    }

    this.routeHandlers.push({ pattern: assetTagsRoutePattern, handler })
    await this.page.route(assetTagsRoutePattern, handler)

    return {
      getCalls: () => [...calls]
    }
  }

  async clearMocks(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
  }
}
