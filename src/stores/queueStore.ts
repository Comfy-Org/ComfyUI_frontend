import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import {
  validateTaskItem,
  TaskItem,
  TaskType,
  TaskPrompt,
  TaskStatus,
  TaskOutput,
  StatusWsMessageStatus
} from '@/types/apiTypes'
import { plainToClass } from 'class-transformer'
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

export class TaskItemImpl {
  taskType: TaskType
  prompt: TaskPrompt
  status?: TaskStatus
  outputs?: TaskOutput

  get apiTaskType(): APITaskType {
    switch (this.taskType) {
      case 'Running':
      case 'Pending':
        return 'queue'
      case 'History':
        return 'history'
    }
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
        switch (this.status!.status_str) {
          case 'success':
            return TaskItemDisplayStatus.Completed
          case 'error':
            return this.interrupted
              ? TaskItemDisplayStatus.Cancelled
              : TaskItemDisplayStatus.Failed
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
}

export const useQueueStore = defineStore('queue', {
  state: (): State => ({
    runningTasks: [],
    pendingTasks: [],
    historyTasks: []
  }),
  getters: {
    tasks(state) {
      return [
        ...state.pendingTasks,
        ...state.runningTasks,
        ...state.historyTasks
      ]
    }
  },
  actions: {
    // Fetch the queue data from the API
    async update() {
      const [queue, history] = await Promise.all([
        api.getQueue(),
        api.getHistory(/* maxItems=*/ 64)
      ])

      const toClassAll = (tasks: TaskItem[]): TaskItemImpl[] =>
        tasks
          .map((task) => validateTaskItem(task))
          .filter((result) => result.success)
          .map((result) => plainToClass(TaskItemImpl, result.data))
          // Desc order to show the latest tasks first
          .sort((a, b) => b.queueIndex - a.queueIndex)

      this.runningTasks = toClassAll(queue.Running)
      this.pendingTasks = toClassAll(queue.Pending)
      this.historyTasks = toClassAll(history.History)
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
        this.count = e.detail.exec_info.queue_remaining
      }
    }
  }
)
