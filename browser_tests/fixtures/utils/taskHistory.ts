import fs from 'fs'
import _ from 'lodash'
import path from 'path'
import type { Request, Route } from 'playwright'
import { v4 as uuidv4 } from 'uuid'

import type {
  HistoryTaskItem,
  TaskItem,
  TaskOutput
} from '../../../src/schemas/apiSchema'
import type { ComfyPage } from '../ComfyPage'

/** keyof TaskOutput[string] */
type OutputFileType = 'images' | 'audio' | 'animated'

const DEFAULT_IMAGE = 'example.webp'

const getFilenameParam = (request: Request) => {
  const url = new URL(request.url())
  return url.searchParams.get('filename') || DEFAULT_IMAGE
}

const getContentType = (filename: string, fileType: OutputFileType) => {
  const subtype = path.extname(filename).slice(1)
  switch (fileType) {
    case 'images':
      return `image/${subtype}`
    case 'audio':
      return `audio/${subtype}`
    case 'animated':
      return `video/${subtype}`
  }
}

const setQueueIndex = (task: TaskItem) => {
  task.prompt.priority = TaskHistory.queueIndex++
}

const setPromptId = (task: TaskItem) => {
  if (!task.prompt.prompt_id || task.prompt.prompt_id === 'prompt-id') {
    task.prompt.prompt_id = uuidv4()
  }
}

export default class TaskHistory {
  static queueIndex = 0
  static readonly defaultTask: Readonly<HistoryTaskItem> = {
    prompt: {
      priority: 0,
      prompt_id: 'prompt-id',
      extra_data: { client_id: uuidv4() }
    },
    outputs: {},
    status: {
      status_str: 'success',
      completed: true,
      messages: []
    },
    taskType: 'History'
  }
  private tasks: HistoryTaskItem[] = []
  private outputContentTypes: Map<string, string> = new Map()

  constructor(readonly comfyPage: ComfyPage) {}

  private loadAsset: (filename: string) => Buffer = _.memoize(
    (filename: string) => {
      const filePath = this.comfyPage.assetPath(filename)
      return fs.readFileSync(filePath)
    }
  )

  private async handleGetHistory(route: Route) {
    const url = route.request().url()

    // Handle history_v2/:prompt_id endpoint
    const promptIdMatch = url.match(/history_v2\/([^?]+)/)
    if (promptIdMatch) {
      const promptId = promptIdMatch[1]
      const task = this.tasks.find((t) => t.prompt.prompt_id === promptId)
      const response: Record<string, any> = {}
      if (task) {
        response[promptId] = task
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    }

    // Handle history_v2 list endpoint
    // Convert HistoryTaskItem to RawHistoryItem format expected by API
    const rawHistoryItems = this.tasks.map((task) => ({
      prompt_id: task.prompt.prompt_id,
      prompt: task.prompt,
      status: task.status,
      outputs: task.outputs,
      ...(task.meta && { meta: task.meta })
    }))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ history: rawHistoryItems })
    })
  }

  private async handleGetView(route: Route) {
    const fileName = getFilenameParam(route.request())
    if (!this.outputContentTypes.has(fileName)) return route.continue()

    const asset = this.loadAsset(fileName)
    return route.fulfill({
      status: 200,
      contentType: this.outputContentTypes.get(fileName),
      body: asset,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
        'Content-Length': asset.byteLength.toString()
      }
    })
  }

  async setupRoutes() {
    return this.comfyPage.page.route(
      /.*\/api\/(view|history_v2)(\/[^?]*)?(\?.*)?$/,
      async (route) => {
        const request = route.request()
        const method = request.method()

        const isViewReq = request.url().includes('view') && method === 'GET'
        if (isViewReq) return this.handleGetView(route)

        const isHistoryPath = request.url().includes('history')
        const isGetHistoryReq = isHistoryPath && method === 'GET'
        if (isGetHistoryReq) return this.handleGetHistory(route)

        const isClearReq =
          method === 'POST' &&
          isHistoryPath &&
          request.postDataJSON()?.clear === true
        if (isClearReq) return this.clearTasks()

        return route.continue()
      }
    )
  }

  private createOutputs(
    filenames: string[],
    filetype: OutputFileType
  ): TaskOutput {
    return filenames.reduce((outputs, filename, i) => {
      const nodeId = `${i + 1}`
      outputs[nodeId] = {
        [filetype]: [{ filename, subfolder: '', type: 'output' }]
      }
      const contentType = getContentType(filename, filetype)
      this.outputContentTypes.set(filename, contentType)
      return outputs
    }, {})
  }

  private addTask(task: HistoryTaskItem) {
    setPromptId(task)
    setQueueIndex(task)
    this.tasks.unshift(task) // Tasks are added to the front of the queue
  }

  clearTasks(): this {
    this.tasks = []
    return this
  }

  withTask(
    outputFilenames: string[],
    outputFiletype: OutputFileType = 'images',
    overrides: Partial<HistoryTaskItem> = {}
  ): this {
    this.addTask({
      ...TaskHistory.defaultTask,
      outputs: this.createOutputs(outputFilenames, outputFiletype),
      ...overrides
    })
    return this
  }

  /** Repeats the last task in the task history a specified number of times. */
  repeat(n: number): this {
    for (let i = 0; i < n; i++)
      this.addTask(structuredClone(this.tasks.at(0)) as HistoryTaskItem)
    return this
  }
}
