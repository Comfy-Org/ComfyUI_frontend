import type { Page, Route } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
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
export interface AssetConfig {
  readonly assets: ReadonlyMap<string, Asset>
  readonly pagination: PaginationOptions | null
  readonly uploadResponse: Record<string, unknown> | null
}

function emptyConfig(): AssetConfig {
  return { assets: new Map(), pagination: null, uploadResponse: null }
}

export type AssetOperator = (config: AssetConfig) => AssetConfig

function addAssets(config: AssetConfig, newAssets: Asset[]): AssetConfig {
  const merged = new Map(config.assets)
  for (const asset of newAssets) {
    merged.set(asset.id, asset)
  }
  return { ...config, assets: merged }
}
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

export function withInputFiles(countOrAssets: number | Asset[]): AssetOperator {
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
  async mock(): Promise<void> {
    const handler = async (route: Route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname
      const isMutation = ['POST', 'PUT', 'DELETE'].includes(method)
      let body: Record<string, unknown> | null = null
      if (isMutation) {
        try {
          body = route.request().postDataJSON()
        } catch {
          body = null
        }
      }

      if (isMutation) {
        this.mutations.push({
          endpoint: path,
          method,
          url: route.request().url(),
          body,
          timestamp: Date.now()
        })
      }

      if (method === 'GET' && /\/assets\/?$/.test(path))
        return this.handleListAssets(route, url)
      if (method === 'GET' && /\/assets\/[^/]+$/.test(path))
        return this.handleGetAsset(route, path)
      if (method === 'PUT' && /\/assets\/[^/]+$/.test(path))
        return this.handleUpdateAsset(route, path, body)
      if (method === 'DELETE' && /\/assets\/[^/]+$/.test(path))
        return this.handleDeleteAsset(route, path)
      if (method === 'POST' && /\/assets\/?$/.test(path))
        return this.handleUploadAsset(route)
      if (method === 'POST' && path.endsWith('/assets/download'))
        return this.handleDownloadAsset(route)

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
  async fetch(
    path: string,
    init?: RequestInit
  ): Promise<{ status: number; body: unknown }> {
    return this.page.evaluate(
      async ([fetchUrl, fetchInit]) => {
        const res = await fetch(fetchUrl, fetchInit)
        const text = await res.text()
        let body: unknown
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
        return { status: res.status, body }
      },
      [path, init] as const
    )
  }

  configure(...operators: AssetOperator[]): void {
    const config = operators.reduce<AssetConfig>(
      (cfg, op) => op(cfg),
      emptyConfig()
    )
    this.store = new Map(config.assets)
    this.paginationOptions = config.pagination
    this.uploadResponse = config.uploadResponse
  }

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
  private handleListAssets(route: Route, url: URL) {
    const includeTags = url.searchParams.get('include_tags')?.split(',') ?? []
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

  private handleGetAsset(route: Route, path: string) {
    const id = path.split('/').pop()!
    const asset = this.store.get(id)
    if (asset) return route.fulfill({ json: asset })
    return route.fulfill({ status: 404, json: { error: 'Not found' } })
  }

  private handleUpdateAsset(route: Route, path: string, body: unknown) {
    const id = path.split('/').pop()!
    const asset = this.store.get(id)
    if (asset) {
      const updated = {
        ...asset,
        ...(body as Record<string, unknown>),
        updated_at: new Date().toISOString()
      }
      this.store.set(id, updated)
      return route.fulfill({ json: updated })
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } })
  }

  private handleDeleteAsset(route: Route, path: string) {
    const id = path.split('/').pop()!
    this.store.delete(id)
    return route.fulfill({ status: 204, body: '' })
  }

  private handleUploadAsset(route: Route) {
    const response = this.uploadResponse ?? {
      id: `upload-${Date.now()}`,
      name: 'uploaded_file.safetensors',
      tags: ['models', 'checkpoints'],
      created_at: new Date().toISOString(),
      created_new: true
    }
    return route.fulfill({ status: 201, json: response })
  }

  private handleDownloadAsset(route: Route) {
    return route.fulfill({
      status: 202,
      json: {
        task_id: 'download-task-001',
        status: 'created',
        message: 'Download started'
      }
    })
  }

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
  private getFilteredAssets(tags: string[]): Asset[] {
    const assets = [...this.store.values()]
    if (tags.length === 0) return assets

    return assets.filter((asset) =>
      tags.every((tag) => (asset.tags ?? []).includes(tag))
    )
  }
}
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
