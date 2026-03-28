import type { Page, Route } from '@playwright/test'

import type {
  Asset,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
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

// ─── Configuration ──────────────────────────────────────────────────────────

export interface AssetConfig {
  readonly assets: ReadonlyMap<string, Asset>
  readonly pagination: PaginationOptions | null
  readonly uploadResponse: Record<string, unknown> | null
}

function emptyConfig(): AssetConfig {
  return { assets: new Map(), pagination: null, uploadResponse: null }
}

export type AssetOperator = (config: AssetConfig) => AssetConfig

function addAssets(
  config: AssetConfig,
  newAssets: Asset[]
): AssetConfig {
  const merged = new Map(config.assets)
  for (const asset of newAssets) {
    merged.set(asset.id, asset)
  }
  return { ...config, assets: merged }
}

// ─── Operators ──────────────────────────────────────────────────────────────

export function withModels(
  countOrAssets: number | Asset[],
  category: 'checkpoints' | 'loras' | 'vae' | 'embeddings' = 'checkpoints'
): AssetOperator {
  return (config) => {
    const assets =
      typeof countOrAssets === 'number'
        ? generateModels(countOrAssets, category)
        : countOrAssets
    return addAssets(config, assets)
  }
}

export function withInputFiles(
  countOrAssets: number | Asset[]
): AssetOperator {
  return (config) => {
    const assets =
      typeof countOrAssets === 'number'
        ? generateInputFiles(countOrAssets)
        : countOrAssets
    return addAssets(config, assets)
  }
}

export function withOutputAssets(
  countOrAssets: number | Asset[]
): AssetOperator {
  return (config) => {
    const assets =
      typeof countOrAssets === 'number'
        ? generateOutputAssets(countOrAssets)
        : countOrAssets
    return addAssets(config, assets)
  }
}

export function withAsset(asset: Asset): AssetOperator {
  return (config) => addAssets(config, [asset])
}

export function withPagination(options: PaginationOptions): AssetOperator {
  return (config) => ({ ...config, pagination: options })
}

export function withUploadResponse(
  response: Record<string, unknown>
): AssetOperator {
  return (config) => ({ ...config, uploadResponse: response })
}

// ─── Helper Class ───────────────────────────────────────────────────────────

export class AssetHelper {
  private store: Map<string, Asset>
  private paginationOptions: PaginationOptions | null
  private routeHandlers: Array<{
    pattern: string
    handler: (route: Route) => Promise<void>
  }> = []
  private mutations: MutationRecord[] = []
  private uploadResponse: Record<string, unknown> | null

  constructor(
    private readonly page: Page,
    config: AssetConfig = emptyConfig()
  ) {
    this.store = new Map(config.assets)
    this.paginationOptions = config.pagination
    this.uploadResponse = config.uploadResponse
  }

  // ─── Activation ─────────────────────────────────────────────────────────

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

        const response: ListAssetsResponse = {
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
          id: `upload-${Date.now()}`,
          name: 'uploaded_file.safetensors',
          tags: ['models', 'checkpoints'],
          created_at: new Date().toISOString(),
          created_new: true
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

  // ─── Inspection ─────────────────────────────────────────────────────────

  getMutations(): MutationRecord[] {
    return [...this.mutations]
  }

  getAssets(): Asset[] {
    return [...this.store.values()]
  }

  getAsset(id: string): Asset | undefined {
    return this.store.get(id)
  }

  get assetCount(): number {
    return this.store.size
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

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

  // ─── Internal ───────────────────────────────────────────────────────────

  private getFilteredAssets(tags: string[]): Asset[] {
    const assets = [...this.store.values()]
    if (tags.length === 0) return assets

    return assets.filter((asset) =>
      tags.every((tag) => (asset.tags ?? []).includes(tag))
    )
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createAssetHelper(
  page: Page,
  ...operators: AssetOperator[]
): AssetHelper {
  const config = operators.reduce<AssetConfig>(
    (cfg, op) => op(cfg),
    emptyConfig()
  )
  return new AssetHelper(page, config)
}
