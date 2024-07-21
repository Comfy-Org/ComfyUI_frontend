import { api } from "@/scripts/api";
import {
  validateTaskItem,
  TaskItem,
  TaskType,
  TaskPrompt,
  TaskStatus,
  TaskOutput,
} from "@/types/apiTypes";
import { plainToClass } from "class-transformer";
import { defineStore } from "pinia";

// Task type used in the API.
export type APITaskType = "queue" | "history";

class TaskItemImpl {
  taskType: TaskType;
  prompt: TaskPrompt;
  status?: TaskStatus;
  outputs?: TaskOutput;

  get apiTaskType(): APITaskType {
    switch (this.taskType) {
      case "Running":
      case "Pending":
        return "queue";
      case "History":
        return "history";
    }
  }

  get queueIndex() {
    return this.prompt[0];
  }

  get promptId() {
    return this.prompt[1];
  }

  get promptInputs() {
    return this.prompt[2];
  }

  get extraData() {
    return this.prompt[3];
  }

  get outputsToExecute() {
    return this.prompt[4];
  }

  get extraPngInfo() {
    return this.extraData.extra_pnginfo;
  }

  get clientId() {
    return this.extraData.client_id;
  }

  get workflow() {
    return this.extraPngInfo.workflow;
  }
}

interface State {
  runningTasks: TaskItemImpl[];
  pendingTasks: TaskItemImpl[];
  historyTasks: TaskItemImpl[];
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
        ...state.pendingTasks,
        ...state.runningTasks,
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

      const toClassAll = (tasks: TaskItem[]): TaskItemImpl[] =>
        tasks
          .map((task) => validateTaskItem(task))
          .filter((result) => result.success)
          .map((result) => plainToClass(TaskItemImpl, result.data));

      this.runningTasks = toClassAll(queue.Running);
      this.pendingTasks = toClassAll(queue.Pending);
      this.historyTasks = toClassAll(history.History);
    },
    async clear() {
      return Promise.all(
        ["queue", "history"].map((type) => api.clearItems(type))
      );
    },
    async delete(task: TaskItemImpl) {
      return api.deleteItem(task.apiTaskType, task.promptId);
    },
  },
});
