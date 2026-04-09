import { readFile } from 'node:fs/promises'

import type { Page, Route } from '@playwright/test'
import type { JobDetailResponse, JobEntry } from '@comfyorg/ingest-types'

import { buildMockJobOutputs } from './buildMockJobOutputs'
import type {
  GeneratedJobFixture,
  GeneratedOutputFixture,
  ImportedAssetFixture
} from './assetScenarioTypes'
import { InMemoryJobsBackend } from './InMemoryJobsBackend'
import { getMimeType } from './mimeTypeUtil'
import {
  buildSeededFileKey,
  buildSeededFiles,
  defaultFileFor
} from './seededAssetFiles'
import type { SeededAssetFile } from './seededAssetFiles'

const inputFilesRoutePattern = /\/internal\/files\/input(?:\?.*)?$/
const viewRoutePattern = /\/api\/view(?:\?.*)?$/
const DEFAULT_FIXTURE_CREATE_TIME = Date.UTC(2024, 0, 1, 0, 0, 0)

type MockPreviewOutput = NonNullable<JobEntry['preview_output']> & {
  filename?: string
  subfolder?: string
  type?: GeneratedOutputFixture['type']
  nodeId: string
  mediaType?: string
  display_name?: string
}

function normalizeOutputFixture(
  output: GeneratedOutputFixture
): GeneratedOutputFixture {
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

function getPreviewOutput(
  previewOutput: JobEntry['preview_output'] | undefined
): MockPreviewOutput | undefined {
  return previewOutput as MockPreviewOutput | undefined
}

function outputsFromJobEntry(
  job: JobEntry
): [GeneratedOutputFixture, ...GeneratedOutputFixture[]] {
  const previewOutput = getPreviewOutput(job.preview_output)
  const outputCount = Math.max(job.outputs_count ?? 1, 1)
  const baseFilename = previewOutput?.filename ?? `output_${job.id}.png`
  const mediaType: GeneratedOutputFixture['mediaType'] =
    previewOutput?.mediaType === 'video' || previewOutput?.mediaType === 'audio'
      ? previewOutput.mediaType
      : 'images'
  const outputs = Array.from({ length: outputCount }, (_, index) => ({
    filename: createOutputFilename(baseFilename, index),
    displayName: index === 0 ? previewOutput?.display_name : undefined,
    mediaType,
    subfolder: previewOutput?.subfolder ?? '',
    type: previewOutput?.type ?? 'output'
  }))

  return [outputs[0], ...outputs.slice(1)]
}

function generatedJobFromJobEntry(job: JobEntry): GeneratedJobFixture {
  return {
    jobId: job.id,
    status: job.status,
    outputs: outputsFromJobEntry(job),
    createTime: job.create_time,
    executionStartTime: job.execution_start_time,
    executionEndTime: job.execution_end_time,
    workflowId: job.workflow_id
  }
}

function buildSeededJob(job: GeneratedJobFixture) {
  const outputs = job.outputs.map(normalizeOutputFixture)
  const preview = outputs[0]
  const createTime =
    job.createTime ??
    (job.createdAt
      ? new Date(job.createdAt).getTime()
      : DEFAULT_FIXTURE_CREATE_TIME)
  const executionStartTime = job.executionStartTime ?? createTime
  const executionEndTime = job.executionEndTime ?? createTime + 2_000

  const listItem: JobEntry = {
    id: job.jobId,
    status: job.status ?? 'completed',
    create_time: createTime,
    execution_start_time: executionStartTime,
    execution_end_time: executionEndTime,
    preview_output: {
      filename: preview.filename,
      subfolder: preview.subfolder ?? '',
      type: preview.type ?? 'output',
      nodeId: job.nodeId ?? '5',
      mediaType: preview.mediaType ?? 'images',
      display_name: preview.displayName
    },
    outputs_count: outputs.length,
    ...(job.workflowId ? { workflow_id: job.workflowId } : {})
  }

  const detail: JobDetailResponse = {
    ...listItem,
    workflow: job.workflow,
    outputs: buildMockJobOutputs(job, outputs),
    update_time: executionEndTime
  }

  return { listItem, detail }
}

export class AssetScenarioHelper {
  private readonly jobsBackend: InMemoryJobsBackend
  private inputFilesRouteHandler: ((route: Route) => Promise<void>) | null =
    null
  private viewRouteHandler: ((route: Route) => Promise<void>) | null = null
  private generatedJobs: GeneratedJobFixture[] = []
  private importedFiles: ImportedAssetFixture[] = []
  private seededFiles = new Map<string, SeededAssetFile>()

  constructor(private readonly page: Page) {
    this.jobsBackend = new InMemoryJobsBackend(page)
  }

  async seedGeneratedHistory(jobs: readonly JobEntry[]): Promise<void> {
    await this.seed({
      generated: jobs.map(generatedJobFromJobEntry),
      imported: this.importedFiles
    })
  }

  async seedImportedFiles(files: readonly string[]): Promise<void> {
    await this.seed({
      generated: this.generatedJobs,
      imported: files.map((name) => ({ name }))
    })
  }

  async seedEmptyState(): Promise<void> {
    await this.seed({ generated: [], imported: [] })
  }

  async clear(): Promise<void> {
    this.generatedJobs = []
    this.importedFiles = []
    this.seededFiles.clear()

    await this.jobsBackend.clear()

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

  private async seed({
    generated,
    imported
  }: {
    generated: GeneratedJobFixture[]
    imported: ImportedAssetFixture[]
  }): Promise<void> {
    this.generatedJobs = [...generated]
    this.importedFiles = [...imported]
    this.seededFiles = buildSeededFiles({
      generated: this.generatedJobs,
      imported: this.importedFiles
    })

    await this.jobsBackend.seed(this.generatedJobs.map(buildSeededJob))
    await this.ensureInputFilesRoute()
    await this.ensureViewRoute()
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
      const type = url.searchParams.get('type') ?? 'output'
      const subfolder = url.searchParams.get('subfolder') ?? ''

      if (!filename) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Missing filename' })
        })
        return
      }

      const seededFile =
        this.seededFiles.get(
          buildSeededFileKey({
            filename,
            type,
            subfolder
          })
        ) ?? defaultFileFor(filename)

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
