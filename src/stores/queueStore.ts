import { api } from "@/scripts/api";
import {
  flattenTaskItem,
  HistoryTaskItemFlat,
  PendingTaskItemFlat,
  RunningTaskItemFlat,
  TaskItem,
  TaskItemFlat,
} from "@/types/apiTypes";
import { defineStore } from "pinia";

interface State {
  runningTasks: RunningTaskItemFlat[];
  pendingTasks: PendingTaskItemFlat[];
  historyTasks: HistoryTaskItemFlat[];
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

export function getTaskType(task: TaskItemFlat) {
  if ("prompt" in task) {
    return TaskType.Running;
  } else if ("inputs" in task) {
    return TaskType.Pending;
  } else {
    return TaskType.History;
  }
}

export const useQueueStore = defineStore("queue", {
  state: (): State => ({
    runningTasks: [],
    pendingTasks: [],
    historyTasks: [],
  }),
  getters: {
    tasks(state) {
      return [
        ...state.runningTasks,
        ...state.pendingTasks,
        ...state.historyTasks,
      ];
    },
  },
  actions: {
    // Fetch the queue data from the API
    async update() {
      const [queue, history] = await Promise.all([
        api.getQueue(),
        api.getHistory(),
      ]);

      const flattenAll = (tasks: TaskItem[]) =>
        tasks.map((task) => flattenTaskItem(task));

      this.runningTasks = flattenAll(queue.Running);
      this.pendingTasks = flattenAll(queue.Pending);
      this.historyTasks = flattenAll(history.History);
    },
    async clear() {
      return Promise.all(
        ["queue", "history"].map((type) => api.clearItems(type))
      );
    },
    async delete(task: TaskItemFlat) {
      return api.deleteItem(
        getAPITaskType(getTaskType(task)),
        task.prompt.promptId
      );
    },
  },
});
