import type { Page, Route } from '@playwright/test'

import type {
  AssetItem,
  AssetResponse
} from '../../../src/platform/assets/schemas/assetSchema'
import {
  generateModels,
  generateInputFiles,
  generateOutputAssets
} from '../data/assetFixtures'

export interface MutationRecord {
  endpoint: string
  method: string
  url: string
  body: unknown
  timestamp: number
}

interface PaginationOptions {
  total: number
  hasMore: boolean
}

export class AssetHelper {
  private store: Map<string, AssetItem> = new Map()
  private paginationOptions: PaginationOptions | null = null
  private routeHandlers: Array<{
    pattern: string
    handler: (route: Route) => Promise<void>
  }> = []
  private mutations: MutationRecord[] = []
  private uploadResponse: Record<string, unknown> | null = null

  constructor(private readonly page: Page) {}

  // ─── Builder Methods (return `this` for chaining) ─────────────────────────

  /**
   * Add model assets to the mock store.
   * Accepts a count (generates deterministic fixtures) or an array of assets.
   */
  withModels(
    countOrAssets: number | AssetItem[],
    category: 'checkpoints' | 'loras' | 'vae' | 'embeddings' = 'checkpoints'
  ): this {
    const assets =
      typeof countOrAssets === 'number'
        ? generateModels(countOrAssets, category)
        : countOrAssets
    for (const asset of assets) {
      this.store.set(asset.id, asset)
    }
    return this
  }

  /**
   * Add input file assets to the mock store.
   */
  withInputFiles(countOrAssets: number | AssetItem[]): this {
    const assets =
      typeof countOrAssets === 'number'
        ? generateInputFiles(countOrAssets)
        : countOrAssets
    for (const asset of assets) {
      this.store.set(asset.id, asset)
    }
    return this
  }

  /**
   * Add output assets to the mock store.
   */
  withOutputAssets(countOrAssets: number | AssetItem[]): this {
    const assets =
      typeof countOrAssets === 'number'
        ? generateOutputAssets(countOrAssets)
        : countOrAssets
    for (const asset of assets) {
      this.store.set(asset.id, asset)
    }
    return this
  }

  /**
   * Add a single specific asset to the mock store.
   */
  withAsset(asset: AssetItem): this {
    this.store.set(asset.id, asset)
    return this
  }

  /**
   * Set empty state (no assets). Clears any previously added assets.
   */
  withEmptyState(): this {
    this.store.clear()
    return this
  }

  /**
   * Configure pagination behavior for the list response.
   */
  withPagination(options: PaginationOptions): this {
    this.paginationOptions = options
    return this
  }

  /**
   * Configure a custom upload response for POST /assets.
   */
  withUploadResponse(response: Record<string, unknown>): this {
    this.uploadResponse = response
    return this
  }

  // ─── Activation ───────────────────────────────────────────────────────────

  /**
   * Install all route handlers based on current builder state.
   * Must be called before page.goto().
   */
  async mock(): Promise<void> {
    const handler = async (route: Route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname

      // Track mutations
      if (['POST', 'PUT', 'DELETE'].includes(method)) {
        this.mutations.push({
          endpoint: path,
          method,
          url: route.request().url(),
          body: route.request().postDataJSON(),
          timestamp: Date.now()
        })
      }

      // GET /assets — list assets
      if (method === 'GET' && /\/assets\/?$/.test(path)) {
        const includeTags =
          url.searchParams.get('include_tags')?.split(',') ?? []
        const limit = parseInt(url.searchParams.get('limit') ?? '0', 10)
        const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

        let filtered = this.getFilteredAssets(includeTags)
        if (limit > 0) {
          filtered = filtered.slice(offset, offset + limit)
        }

        const response: AssetResponse = {
          assets: filtered,
          total: this.paginationOptions?.total ?? this.store.size,
          has_more: this.paginationOptions?.hasMore ?? false
        }
        return route.fulfill({ json: response })
      }

      // GET /assets/:id — single asset details
      if (method === 'GET' && /\/assets\/[^/]+$/.test(path)) {
        const id = path.split('/').pop()!
        const asset = this.store.get(id)
        if (asset) {
          return route.fulfill({ json: asset })
        }
        return route.fulfill({
          status: 404,
          json: { error: 'Not found' }
        })
      }

      // PUT /assets/:id — update asset
      if (method === 'PUT' && /\/assets\/[^/]+$/.test(path)) {
        const id = path.split('/').pop()!
        const asset = this.store.get(id)
        if (asset) {
          const body = route.request().postDataJSON()
          const updated = {
            ...asset,
            ...body,
            updated_at: new Date().toISOString()
          }
          this.store.set(id, updated)
          return route.fulfill({ json: updated })
        }
        return route.fulfill({
          status: 404,
          json: { error: 'Not found' }
        })
      }

      // DELETE /assets/:id — delete asset
      if (method === 'DELETE' && /\/assets\/[^/]+$/.test(path)) {
        const id = path.split('/').pop()!
        this.store.delete(id)
        return route.fulfill({ status: 204, body: '' })
      }

      // POST /assets — upload
      if (method === 'POST' && /\/assets\/?$/.test(path)) {
        const response = this.uploadResponse ?? {
          type: 'sync',
          asset: {
            id: `upload-${Date.now()}`,
            name: 'uploaded_file.safetensors',
            tags: ['models', 'checkpoints'],
            created_at: new Date().toISOString()
          }
        }
        return route.fulfill({ status: 201, json: response })
      }

      // POST /assets/download — async download
      if (method === 'POST' && path.endsWith('/assets/download')) {
        return route.fulfill({
          status: 202,
          json: {
            task_id: 'download-task-001',
            status: 'created',
            message: 'Download started'
          }
        })
      }

      // Fallback — let unhandled requests through
      return route.fallback()
    }

    const pattern = '**/assets**'
    this.routeHandlers.push({ pattern, handler })
    await this.page.route(pattern, handler)
  }

  /**
   * Mock a specific error response for any asset endpoint.
   */
  async mockError(
    statusCode: number,
    error: string = 'Internal Server Error'
  ): Promise<void> {
    const handler = async (route: Route) => {
      return route.fulfill({
        status: statusCode,
        json: { error }
      })
    }

    const pattern = '**/assets**'
    this.routeHandlers.push({ pattern, handler })
    await this.page.route(pattern, handler)
  }

  // ─── Inspection ───────────────────────────────────────────────────────────

  /**
   * Get all recorded mutations (POST, PUT, DELETE requests).
   */
  getMutations(): MutationRecord[] {
    return [...this.mutations]
  }

  /**
   * Get the current assets in the mock store.
   */
  getAssets(): AssetItem[] {
    return [...this.store.values()]
  }

  /**
   * Get a single asset from the mock store by ID.
   */
  getAsset(id: string): AssetItem | undefined {
    return this.store.get(id)
  }

  /**
   * Get the number of assets currently in the mock store.
   */
  get assetCount(): number {
    return this.store.size
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  /**
   * Clear all route mocks and reset internal state.
   */
  async clearMocks(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
    this.routeHandlers = []
    this.store.clear()
    this.mutations = []
    this.paginationOptions = null
    this.uploadResponse = null
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private getFilteredAssets(tags: string[]): AssetItem[] {
    const assets = [...this.store.values()]
    if (tags.length === 0) return assets

    return assets.filter((asset) =>
      tags.every((tag) => asset.tags.includes(tag))
    )
  }
}
