import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { HistoryTaskItem, TaskOutput } from '../../../src/types/apiTypes'
import type { Page, Request } from 'playwright'

const DEFAULT_IMAGE = 'example.webp'

export class HistoryBuilder {
  static queueIndex = 0
  static readonly defaultTask: HistoryTaskItem = {
    prompt: [0, 'prompt-id', {}, { client_id: 'placeholder-client-id' }, []],
    outputs: {},
    status: {
      status_str: 'success',
      completed: true,
      messages: []
    },
    taskType: 'History'
  }
  static readonly assetCache: Map<string, Buffer> = new Map()

  private tasks: HistoryTaskItem[] = []
  private outputFiles: Set<string> = new Set()

  constructor(private page: Page) {}

  private setQueueIndex(task: HistoryTaskItem) {
    task.prompt[0] = HistoryBuilder.queueIndex++
  }

  private setPromptId(task: HistoryTaskItem) {
    task.prompt[1] = uuidv4()
  }

  private getAssetPath(filename: string): string {
    return `./browser_tests/assets/${filename}`
  }

  private getContentType(filename: string): string {
    return `image/${path.extname(filename).slice(1)}`
  }

  private createOutputRecord(filename: string): TaskOutput[string] {
    return {
      images: [{ filename, subfolder: '', type: 'output' }]
    }
  }

  private getFilenameParam(request: Request): string {
    const url = new URL(request.url())
    return url.searchParams.get('filename') || DEFAULT_IMAGE
  }

  private addOutputsToTask(
    task: HistoryTaskItem,
    outputFilenames: string[]
  ): void {
    outputFilenames.forEach((filename, i) => {
      const nodeId = `${i + 1}`
      task.outputs[nodeId] = this.createOutputRecord(filename)
      this.outputFiles.add(filename)
    })
  }

  private createNewTask(
    template: HistoryTaskItem = HistoryBuilder.defaultTask
  ): HistoryTaskItem {
    const taskCopy = structuredClone(template)
    this.setPromptId(taskCopy)
    this.setQueueIndex(taskCopy)
    return taskCopy
  }

  private loadAsset(filename: string): Buffer {
    const filePath = this.getAssetPath(filename)
    if (HistoryBuilder.assetCache.has(filePath)) {
      return HistoryBuilder.assetCache.get(filePath)!
    }
    const asset = fs.readFileSync(filePath)
    HistoryBuilder.assetCache.set(filePath, asset)
    return asset
  }

  private async setupViewRoute() {
    return this.page.route('**/api/view*', async (route) => {
      const request = route.request()
      const fileName = this.getFilenameParam(request)
      const asset = this.loadAsset(fileName)
      await route.fulfill({
        status: 200,
        contentType: this.getContentType(fileName),
        body: asset,
        headers: {
          'Cache-Control': 'public, max-age=31536000',
          'Content-Length': asset.byteLength.toString()
        }
      })
    })
  }

  private async setupHistoryRoute() {
    await this.page.route('**/api/history*', async (route) => {
      const method = route.request().method()

      if (method === 'POST') {
        if (route.request().postDataJSON()?.clear === true) this.tasks = []
        return route.continue()
      }

      // Return the current task history for GET requests
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(this.tasks)
      })
    })
  }

  async setupRoutes() {
    await Promise.all([this.setupViewRoute(), this.setupHistoryRoute()])
  }

  withTask(
    outputFilenames: string[],
    overrides: Partial<HistoryTaskItem> = {}
  ): this {
    const task = this.createNewTask()
    this.addOutputsToTask(task, outputFilenames)
    this.tasks.push({ ...task, ...overrides })
    return this
  }

  repeat(n: number): this {
    for (let i = 0; i < n; i++) {
      const lastTaskCopy = { ...this.tasks.at(-1) } as HistoryTaskItem
      this.tasks.push(this.createNewTask(lastTaskCopy))
    }
    return this
  }
}
