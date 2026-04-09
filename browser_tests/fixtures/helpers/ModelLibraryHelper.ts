import type { Page, Route } from '@playwright/test'

import type {
  ModelFile,
  ModelFolderInfo
} from '@/platform/assets/schemas/assetSchema'

const modelFoldersRoutePattern = /\/api\/experiment\/models$/
const modelFilesRoutePattern = /\/api\/experiment\/models\/([^?]+)/
const viewMetadataRoutePattern = /\/api\/view_metadata\/([^?]+)/

export interface MockModelMetadata {
  'modelspec.title'?: string
  'modelspec.author'?: string
  'modelspec.architecture'?: string
  'modelspec.description'?: string
  'modelspec.resolution'?: string
  'modelspec.tags'?: string
}

export function createMockModelFolders(names: string[]): ModelFolderInfo[] {
  return names.map((name) => ({ name, folders: [] }))
}

export function createMockModelFiles(
  filenames: string[],
  pathIndex = 0
): ModelFile[] {
  return filenames.map((name) => ({ name, pathIndex }))
}

export class ModelLibraryHelper {
  private foldersRouteHandler: ((route: Route) => Promise<void>) | null = null
  private filesRouteHandler: ((route: Route) => Promise<void>) | null = null
  private metadataRouteHandler: ((route: Route) => Promise<void>) | null = null
  private folders: ModelFolderInfo[] = []
  private filesByFolder: Record<string, ModelFile[]> = {}
  private metadataByModel: Record<string, MockModelMetadata> = {}

  constructor(private readonly page: Page) {}

  async mockModelFolders(folders: ModelFolderInfo[]): Promise<void> {
    this.folders = [...folders]

    if (this.foldersRouteHandler) return

    this.foldersRouteHandler = async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.folders)
      })
    }

    await this.page.route(modelFoldersRoutePattern, this.foldersRouteHandler)
  }

  async mockModelFiles(folder: string, files: ModelFile[]): Promise<void> {
    this.filesByFolder[folder] = [...files]

    if (this.filesRouteHandler) return

    this.filesRouteHandler = async (route: Route) => {
      const match = route.request().url().match(modelFilesRoutePattern)
      const folderName = match?.[1] ? decodeURIComponent(match[1]) : undefined
      const files = folderName ? (this.filesByFolder[folderName] ?? []) : []

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(files)
      })
    }

    await this.page.route(modelFilesRoutePattern, this.filesRouteHandler)
  }

  async mockMetadata(
    entries: Record<string, MockModelMetadata>
  ): Promise<void> {
    Object.assign(this.metadataByModel, entries)

    if (this.metadataRouteHandler) return

    this.metadataRouteHandler = async (route: Route) => {
      const url = new URL(route.request().url())
      const filename = url.searchParams.get('filename') ?? ''
      const metadata = this.metadataByModel[filename]

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(metadata ?? {})
      })
    }

    await this.page.route(viewMetadataRoutePattern, this.metadataRouteHandler)
  }

  async mockFoldersWithFiles(config: Record<string, string[]>): Promise<void> {
    const folderNames = Object.keys(config)
    await this.mockModelFolders(createMockModelFolders(folderNames))
    for (const [folder, files] of Object.entries(config)) {
      await this.mockModelFiles(folder, createMockModelFiles(files))
    }
  }

  async clearMocks(): Promise<void> {
    this.folders = []
    this.filesByFolder = {}
    this.metadataByModel = {}

    if (this.foldersRouteHandler) {
      await this.page.unroute(
        modelFoldersRoutePattern,
        this.foldersRouteHandler
      )
      this.foldersRouteHandler = null
    }

    if (this.filesRouteHandler) {
      await this.page.unroute(modelFilesRoutePattern, this.filesRouteHandler)
      this.filesRouteHandler = null
    }

    if (this.metadataRouteHandler) {
      await this.page.unroute(
        viewMetadataRoutePattern,
        this.metadataRouteHandler
      )
      this.metadataRouteHandler = null
    }
  }
}
