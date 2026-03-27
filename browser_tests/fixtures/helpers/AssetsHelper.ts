import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type { Page, Route } from '@playwright/test'

import type {
  JobDetail,
  RawJobListItem
} from '../../../src/platform/remote/comfyui/jobs/jobTypes'
import type { ResultItemType, TaskOutput } from '../../../src/schemas/apiSchema'

import { JobsApiMock, type SeededJob } from './JobsApiMock'
import { getMimeType } from './mimeTypeUtil'

const inputFilesRoutePattern = /\/internal\/files\/input(?:\?.*)?$/
const viewRoutePattern = /\/api\/view(?:\?.*)?$/
const helperDir = path.dirname(fileURLToPath(import.meta.url))

type SeededAssetFile = {
  filePath?: string
  contentType?: string
  textContent?: string
}

export type ImportedAssetSeed = {
  name: string
  filePath?: string
  contentType?: string
}

export type GeneratedAssetOutputSeed = {
  filename: string
  displayName?: string
  filePath?: string
  contentType?: string
  mediaType?: 'images' | 'video' | 'audio'
  subfolder?: string
  type?: ResultItemType
}

export type GeneratedJobSeed = {
  jobId: string
  outputs: [GeneratedAssetOutputSeed, ...GeneratedAssetOutputSeed[]]
  createdAt?: string
  createTime?: number
  executionStartTime?: number
  executionEndTime?: number
  workflowId?: string | null
  workflow?: unknown
  nodeId?: string
}

function getFixturePath(relativePath: string): string {
  return path.resolve(helperDir, '../../assets', relativePath)
}

function defaultFileFor(filename: string): SeededAssetFile {
  const name = filename.toLowerCase()

  if (name.endsWith('.png')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow_itxt.png'),
      contentType: 'image/png'
    }
  }

  if (name.endsWith('.webp')) {
    return {
      filePath: getFixturePath('example.webp'),
      contentType: 'image/webp'
    }
  }

  if (name.endsWith('.webm')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow.webm'),
      contentType: 'video/webm'
    }
  }

  if (name.endsWith('.mp4')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow.mp4'),
      contentType: 'video/mp4'
    }
  }

  if (name.endsWith('.glb')) {
    return {
      filePath: getFixturePath('workflowInMedia/workflow.glb'),
      contentType: 'model/gltf-binary'
    }
  }

  if (name.endsWith('.json')) {
    return {
      textContent: JSON.stringify({ mocked: true }, null, 2),
      contentType: 'application/json'
    }
  }

  return {
    textContent: 'mocked asset content',
    contentType: getMimeType(filename)
  }
}

function normalizeOutputSeed(
  output: GeneratedAssetOutputSeed
): GeneratedAssetOutputSeed {
  const fallback = defaultFileFor(output.filename)

  return {
    mediaType: 'images',
    subfolder: '',
    type: 'output',
    ...output,
    filePath: output.filePath ?? fallback.filePath,
    contentType: output.contentType ?? fallback.contentType
  }
}

function buildTaskOutput(
  jobSeed: GeneratedJobSeed,
  outputs: GeneratedAssetOutputSeed[]
): TaskOutput {
  const nodeId = jobSeed.nodeId ?? '5'

  return {
    [nodeId]: {
      [outputs[0].mediaType ?? 'images']: outputs.map((output) => ({
        filename: output.filename,
        subfolder: output.subfolder ?? '',
        type: output.type ?? 'output',
        display_name: output.displayName
      }))
    }
  }
}

function buildSeededJob(jobSeed: GeneratedJobSeed): SeededJob {
  const outputs = jobSeed.outputs.map(normalizeOutputSeed)
  const preview = outputs[0]
  const createTime =
    jobSeed.createTime ??
    new Date(jobSeed.createdAt ?? '2026-03-27T12:00:00.000Z').getTime()
  const executionStartTime = jobSeed.executionStartTime ?? createTime
  const executionEndTime = jobSeed.executionEndTime ?? createTime + 2_000

  const listItem: RawJobListItem = {
    id: jobSeed.jobId,
    status: 'completed',
    create_time: createTime,
    execution_start_time: executionStartTime,
    execution_end_time: executionEndTime,
    preview_output: {
      filename: preview.filename,
      subfolder: preview.subfolder ?? '',
      type: preview.type ?? 'output',
      nodeId: jobSeed.nodeId ?? '5',
      mediaType: preview.mediaType ?? 'images',
      display_name: preview.displayName
    },
    outputs_count: outputs.length,
    workflow_id: jobSeed.workflowId ?? null
  }

  const detail: JobDetail = {
    ...listItem,
    workflow: jobSeed.workflow,
    outputs: buildTaskOutput(jobSeed, outputs),
    update_time: executionEndTime
  }

  return { listItem, detail }
}

export class AssetsHelper {
  private readonly jobsApiMock: JobsApiMock
  private inputFilesRouteHandler: ((route: Route) => Promise<void>) | null =
    null
  private viewRouteHandler: ((route: Route) => Promise<void>) | null = null
  private generatedJobs: GeneratedJobSeed[] = []
  private importedFiles: ImportedAssetSeed[] = []
  private seededFiles = new Map<string, SeededAssetFile>()

  constructor(private readonly page: Page) {
    this.jobsApiMock = new JobsApiMock(page)
  }

  generatedImage(
    options: Partial<Omit<GeneratedJobSeed, 'outputs'>> & {
      filename: string
      displayName?: string
      filePath?: string
      contentType?: string
    }
  ): GeneratedJobSeed {
    const {
      filename,
      displayName,
      filePath,
      contentType,
      jobId = `job-${filename.replace(/\W+/g, '-').toLowerCase()}`,
      ...rest
    } = options

    return {
      jobId,
      outputs: [
        {
          filename,
          displayName,
          filePath,
          contentType,
          mediaType: 'images'
        }
      ],
      ...rest
    }
  }

  importedImage(options: ImportedAssetSeed): ImportedAssetSeed {
    return { ...options }
  }

  async workflowContainerFromFixture(
    relativePath: string = 'default.json'
  ): Promise<GeneratedJobSeed['workflow']> {
    const workflow = JSON.parse(
      await readFile(getFixturePath(relativePath), 'utf-8')
    )

    return {
      extra_data: {
        extra_pnginfo: {
          workflow
        }
      }
    }
  }

  async seedAssets({
    generated = [],
    imported = []
  }: {
    generated?: GeneratedJobSeed[]
    imported?: ImportedAssetSeed[]
  }): Promise<void> {
    this.generatedJobs = [...generated]
    this.importedFiles = [...imported]
    this.seededFiles = new Map()

    for (const job of this.generatedJobs) {
      for (const output of job.outputs) {
        const fallback = defaultFileFor(output.filename)
        this.seededFiles.set(output.filename, {
          filePath: output.filePath ?? fallback.filePath,
          contentType: output.contentType ?? fallback.contentType,
          textContent: fallback.textContent
        })
      }
    }

    for (const asset of this.importedFiles) {
      const fallback = defaultFileFor(asset.name)
      this.seededFiles.set(asset.name, {
        filePath: asset.filePath ?? fallback.filePath,
        contentType: asset.contentType ?? fallback.contentType,
        textContent: fallback.textContent
      })
    }

    await this.jobsApiMock.seedJobs(this.generatedJobs.map(buildSeededJob))
    await this.ensureInputFilesRoute()
    await this.ensureViewRoute()
  }

  async mockEmptyState(): Promise<void> {
    await this.seedAssets({ generated: [], imported: [] })
  }

  async clearMocks(): Promise<void> {
    this.generatedJobs = []
    this.importedFiles = []
    this.seededFiles.clear()

    await this.jobsApiMock.clearMocks()

    if (this.inputFilesRouteHandler) {
      await this.page.unroute(
        inputFilesRoutePattern,
        this.inputFilesRouteHandler
      )
      this.inputFilesRouteHandler = null
    }

    if (this.viewRouteHandler) {
      await this.page.unroute(viewRoutePattern, this.viewRouteHandler)
      this.viewRouteHandler = null
    }
  }

  private async ensureInputFilesRoute(): Promise<void> {
    if (this.inputFilesRouteHandler) {
      return
    }

    this.inputFilesRouteHandler = async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.importedFiles.map((asset) => asset.name))
      })
    }

    await this.page.route(inputFilesRoutePattern, this.inputFilesRouteHandler)
  }

  private async ensureViewRoute(): Promise<void> {
    if (this.viewRouteHandler) {
      return
    }

    this.viewRouteHandler = async (route: Route) => {
      const url = new URL(route.request().url())
      const filename = url.searchParams.get('filename')

      if (!filename) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Missing filename' })
        })
        return
      }

      const seededFile =
        this.seededFiles.get(filename) ?? defaultFileFor(filename)

      if (seededFile.filePath) {
        const body = await readFile(seededFile.filePath)
        await route.fulfill({
          status: 200,
          contentType: seededFile.contentType ?? getMimeType(filename),
          body
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: seededFile.contentType ?? getMimeType(filename),
        body: seededFile.textContent ?? ''
      })
    }

    await this.page.route(viewRoutePattern, this.viewRouteHandler)
  }
}
