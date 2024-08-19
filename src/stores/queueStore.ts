import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type {
  TaskItem,
  TaskType,
  TaskPrompt,
  TaskStatus,
  StatusWsMessageStatus,
  TaskOutput,
  ResultItem
} from '@/types/apiTypes'
import type { NodeId } from '@/types/comfyWorkflow'
import { instanceToPlain, plainToClass } from 'class-transformer'
import _ from 'lodash'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'

// Task type used in the API.
export type APITaskType = 'queue' | 'history'

export enum TaskItemDisplayStatus {
  Running = 'Running',
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

export class ResultItemImpl {
  filename: string
  subfolder?: string
  type: string

  nodeId: NodeId
  // 'audio' | 'images' | ...
  mediaType: string

  get url(): string {
    return api.apiURL(`/view?filename=${encodeURIComponent(this.filename)}&type=${this.type}&
					subfolder=${encodeURIComponent(this.subfolder || '')}`)
  }

  get urlWithTimestamp(): string {
    return `${this.url}&t=${+new Date()}`
  }

  get supportsPreview(): boolean {
    return ['images', 'gifs'].includes(this.mediaType)
  }
}

export class TaskItemImpl {
  readonly taskType: TaskType
  readonly prompt: TaskPrompt
  readonly status?: TaskStatus
  readonly outputs: TaskOutput
  readonly flatOutputs: ReadonlyArray<ResultItemImpl>

  constructor(
    taskType: TaskType,
    prompt: TaskPrompt,
    status: TaskStatus | undefined,
    outputs: TaskOutput,
    flatOutputs?: ReadonlyArray<ResultItemImpl>
  ) {
    this.taskType = taskType
    this.prompt = prompt
    this.status = status
    this.outputs = outputs
    this.flatOutputs = flatOutputs ?? this.calculateFlatOutputs()
  }

  private calculateFlatOutputs(): ReadonlyArray<ResultItemImpl> {
    if (!this.outputs) {
      return []
    }
    return Object.entries(this.outputs).flatMap(([nodeId, nodeOutputs]) =>
      Object.entries(nodeOutputs).flatMap(([mediaType, items]) =>
        (items as ResultItem[]).map((item: ResultItem) =>
          plainToClass(ResultItemImpl, {
            ...item,
            nodeId,
            mediaType
          })
        )
      )
    )
  }

  get previewOutput(): ResultItemImpl | undefined {
    return this.flatOutputs.find((output) => output.supportsPreview)
  }

  get apiTaskType(): APITaskType {
    switch (this.taskType) {
      case 'Running':
      case 'Pending':
        return 'queue'
      case 'History':
        return 'history'
    }
  }

  get key() {
    return this.promptId + this.displayStatus
  }

  get queueIndex() {
    return this.prompt[0]
  }

  get promptId() {
    return this.prompt[1]
  }

  get promptInputs() {
    return this.prompt[2]
  }

  get extraData() {
    return this.prompt[3]
  }

  get outputsToExecute() {
    return this.prompt[4]
  }

  get extraPngInfo() {
    return this.extraData.extra_pnginfo
  }

  get clientId() {
    return this.extraData.client_id
  }

  get workflow() {
    return this.extraPngInfo.workflow
  }

  get messages() {
    return this.status?.messages || []
  }

  get interrupted() {
    return _.some(
      this.messages,
      (message) => message[0] === 'execution_interrupted'
    )
  }

  get isHistory() {
    return this.taskType === 'History'
  }

  get isRunning() {
    return this.taskType === 'Running'
  }

  get displayStatus(): TaskItemDisplayStatus {
    switch (this.taskType) {
      case 'Running':
        return TaskItemDisplayStatus.Running
      case 'Pending':
        return TaskItemDisplayStatus.Pending
      case 'History':
        if (this.interrupted) return TaskItemDisplayStatus.Cancelled

        switch (this.status!.status_str) {
          case 'success':
            return TaskItemDisplayStatus.Completed
          case 'error':
            return TaskItemDisplayStatus.Failed
        }
    }
  }

  get executionStartTimestamp() {
    const message = this.messages.find(
      (message) => message[0] === 'execution_start'
    )
    return message ? message[1].timestamp : undefined
  }

  get executionEndTimestamp() {
    const messages = this.messages.filter((message) =>
      [
        'execution_success',
        'execution_interrupted',
        'execution_error'
      ].includes(message[0])
    )
    if (!messages.length) {
      return undefined
    }
    return _.max(messages.map((message) => message[1].timestamp))
  }

  get executionTime() {
    if (!this.executionStartTimestamp || !this.executionEndTimestamp) {
      return undefined
    }
    return this.executionEndTimestamp - this.executionStartTimestamp
  }

  get executionTimeInSeconds() {
    return this.executionTime !== undefined
      ? this.executionTime / 1000
      : undefined
  }

  public async loadWorkflow() {
    await app.loadGraphData(toRaw(this.workflow))
    if (this.outputs) {
      app.nodeOutputs = toRaw(this.outputs)
    }
  }
}

interface State {
  runningTasks: TaskItemImpl[]
  pendingTasks: TaskItemImpl[]
  historyTasks: TaskItemImpl[]
  maxHistoryItems: number
}

export const useQueueStore = defineStore('queue', {
  state: (): State => ({
    runningTasks: [],
    pendingTasks: [],
    historyTasks: [],
    maxHistoryItems: 64
  }),
  getters: {
    tasks(state) {
      return [
        ...state.pendingTasks,
        ...state.runningTasks,
        ...state.historyTasks
      ]
    },
    flatTasks(): TaskItemImpl[] {
      return this.tasks.flatMap((task: TaskItemImpl) => {
        if (task.displayStatus !== TaskItemDisplayStatus.Completed) {
          return [task]
        }

        return task.flatOutputs.map(
          (output: ResultItemImpl, i: number) =>
            new TaskItemImpl(
              task.taskType,
              [
                task.queueIndex,
                `${task.promptId}-${i}`,
                task.promptInputs,
                task.extraData,
                task.outputsToExecute
              ],
              task.status,
              {
                [output.nodeId]: {
                  [output.mediaType]: [output]
                }
              },
              [output]
            )
        )
      })
    },
    lastHistoryQueueIndex(state) {
      return state.historyTasks.length ? state.historyTasks[0].queueIndex : -1
    }
  },
  actions: {
    // Fetch the queue data from the API
    async update() {
      const [queue, history] = await Promise.all([
        api.getQueue(),
        api.getHistory(this.maxHistoryItems)
      ])

      const toClassAll = (tasks: TaskItem[]): TaskItemImpl[] =>
        tasks
          .map(
            (task: TaskItem) =>
              new TaskItemImpl(
                task.taskType,
                task.prompt,
                task['status'],
                task['outputs'] || {}
              )
          )
          // Desc order to show the latest tasks first
          .sort((a, b) => b.queueIndex - a.queueIndex)

      this.runningTasks = toClassAll(queue.Running)
      this.pendingTasks = toClassAll(queue.Pending)

      // Process history items
      const allIndex = new Set(
        history.History.map((item: TaskItem) => item.prompt[0])
      )
      const newHistoryItems = toClassAll(
        history.History.filter(
          (item) => item.prompt[0] > this.lastHistoryQueueIndex
        )
      )
      const existingHistoryItems = this.historyTasks.filter(
        (item: TaskItemImpl) => allIndex.has(item.queueIndex)
      )
      this.historyTasks = [...newHistoryItems, ...existingHistoryItems]
        .slice(0, this.maxHistoryItems)
        .sort((a, b) => b.queueIndex - a.queueIndex)
    },
    async clear() {
      await Promise.all(
        ['queue', 'history'].map((type) => api.clearItems(type))
      )
      await this.update()
    },
    async delete(task: TaskItemImpl) {
      await api.deleteItem(task.apiTaskType, task.promptId)
      await this.update()
    }
  }
})

export const useQueuePendingTaskCountStore = defineStore(
  'queuePendingTaskCount',
  {
    state: () => ({
      count: 0
    }),
    actions: {
      update(e: CustomEvent<StatusWsMessageStatus>) {
        this.count = e.detail?.exec_info?.queue_remaining || 0
      }
    }
  }
)
