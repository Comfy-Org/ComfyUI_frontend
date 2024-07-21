import { api } from "@/scripts/api";
import {
  HistoryTaskItem,
  PendingTaskItem,
  RunningTaskItem,
  TaskItem,
} from "@/types/apiTypes";
import { defineStore } from "pinia";

interface State {
  runningTasks: RunningTaskItem[];
  pendingTasks: PendingTaskItem[];
  historyTasks: HistoryTaskItem[];
}

export enum TaskType {
  Running = "Running",
  Pending = "Pending",
  History = "History",
}

// Task type used in the API.
export type APITaskType = "queue" | "history";

export function getAPITaskType(taskType: TaskType): APITaskType {
  switch (taskType) {
    case TaskType.Running:
      return "queue";
    case TaskType.Pending:
      return "queue";
    case TaskType.History:
      return "history";
  }
}

export function getTaskType(task: TaskItem) {
  if ("prompt" in task) {
    return TaskType.Running;
  } else if ("inputs" in task) {
    return TaskType.Pending;
  } else {
    return TaskType.History;
  }
}

export function getTaskId(task: TaskItem): string {
  return task.prompt[1];
}

export const useQueueStore = defineStore("queue", {
  state: (): State => ({
    runningTasks: [],
    pendingTasks: [],
    historyTasks: [],
  }),
  actions: {
    // Fetch the queue data from the API
    async update() {
      const [queue, history] = await Promise.all([
        api.getQueue(),
        api.getHistory(),
      ]);

      this.runningTasks = queue.Running;
      this.pendingTasks = queue.Pending;
      this.historyTasks = history.History;
    },
    async clear() {
      return Promise.all(
        ["queue", "history"].map((type) => api.clearItems(type))
      );
    },
    async delete(task: TaskItem) {
      return api.deleteItem(getAPITaskType(getTaskType(task)), getTaskId(task));
    },
  },
});
