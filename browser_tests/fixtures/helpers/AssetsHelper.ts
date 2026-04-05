import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type { Page, Route } from '@playwright/test'

import type {
  JobDetail,
  RawJobListItem
} from '../../../src/platform/remote/comfyui/jobs/jobTypes'
import type { ResultItemType, TaskOutput } from '../../../src/schemas/apiSchema'

import { JobsApiMock } from './JobsApiMock'
import type { SeededJob } from './JobsApiMock'
import { getMimeType } from './mimeTypeUtil'

const inputFilesRoutePattern = /\/internal\/files\/input(?:\?.*)?$/
const viewRoutePattern = /\/api\/view(?:\?.*)?$/
const helperDir = path.dirname(fileURLToPath(import.meta.url))

type SeededAssetFile = {
  filePath?: string
  contentType?: string
  textContent?: string
}

/** Factory to create a mock completed job with preview output. */
export function createMockJob(
  overrides: Partial<RawJobListItem> & { id: string }
): RawJobListItem {
  const now = Date.now() / 1000
  return {
    status: 'completed',
    create_time: now,
    execution_start_time: now,
    execution_end_time: now + 5,
    preview_output: {
      filename: `output_${overrides.id}.png`,
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1,
    priority: 0,
    ...overrides
  }
}

/** Create multiple mock jobs with sequential IDs and staggered timestamps. */
export function createMockJobs(
  count: number,
  baseOverrides?: Partial<RawJobListItem>
): RawJobListItem[] {
  const now = Date.now() / 1000
  return Array.from({ length: count }, (_, i) =>
    createMockJob({
      id: `job-${String(i + 1).padStart(3, '0')}`,
      create_time: now - i * 60,
      execution_start_time: now - i * 60,
      execution_end_time: now - i * 60 + 5 + i,
      preview_output: {
        filename: `image_${String(i + 1).padStart(3, '0')}.png`,
        subfolder: '',
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      },
      ...baseOverrides
    })
  )
}

/** Create mock imported file names with various media types. */
export function createMockImportedFiles(count: number): string[] {
  const extensions = ['png', 'jpg', 'mp4', 'wav', 'glb', 'txt']
  return Array.from(
    { length: count },
    (_, i) =>
      `imported_${String(i + 1).padStart(3, '0')}.${extensions[i % extensions.length]}`
  )
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

function createOutputFilename(baseFilename: string, index: number): string {
  if (index === 0) {
    return baseFilename
  }

  const extensionIndex = baseFilename.lastIndexOf('.')
  if (extensionIndex === -1) {
    return `${baseFilename}-${index + 1}`
  }

  return `${baseFilename.slice(0, extensionIndex)}-${index + 1}${baseFilename.slice(extensionIndex)}`
}

function normalizeMediaType(
  mediaType: string | null | undefined
): 'images' | 'video' | 'audio' {
  if (
    mediaType === 'images' ||
    mediaType === 'video' ||
    mediaType === 'audio'
  ) {
    return mediaType
  }

  return 'images'
}

function outputsFromRawJob(
  job: RawJobListItem
): [GeneratedAssetOutputSeed, ...GeneratedAssetOutputSeed[]] {
  const previewOutput = job.preview_output
  const outputCount = Math.max(job.outputs_count ?? 1, 1)
  const baseFilename = previewOutput?.filename ?? `output_${job.id}.png`
  const outputs = Array.from({ length: outputCount }, (_, index) => ({
    filename: createOutputFilename(baseFilename, index),
    displayName: index === 0 ? previewOutput?.display_name : undefined,
    mediaType: normalizeMediaType(previewOutput?.mediaType),
    subfolder: previewOutput?.subfolder ?? '',
    type: previewOutput?.type ?? 'output'
  }))

  return [outputs[0], ...outputs.slice(1)]
}

function generatedJobFromRawJob(job: RawJobListItem): GeneratedJobSeed {
  return {
    jobId: job.id,
    outputs: outputsFromRawJob(job),
    createTime: job.create_time,
    executionStartTime: job.execution_start_time ?? undefined,
    executionEndTime: job.execution_end_time ?? undefined,
    workflowId: job.workflow_id ?? null
  }
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

  async mockOutputHistory(jobs: RawJobListItem[]): Promise<void> {
    await this.seedAssets({
      generated: jobs.map(generatedJobFromRawJob),
      imported: this.importedFiles
    })
  }

  async mockInputFiles(files: string[]): Promise<void> {
    await this.seedAssets({
      generated: this.generatedJobs,
      imported: files.map((name) => ({ name }))
    })
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
