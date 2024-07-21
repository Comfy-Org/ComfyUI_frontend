<template>
  <DataTable :value="tasks" dataKey="promptId">
    <Column header="STATUS">
      <template #body="{ data }">
        <Tag :severity="taskTagSeverity(data.displayStatus)">
          {{ data.displayStatus.toUpperCase() }}
        </Tag>
      </template>
    </Column>
    <Column header="TIME">
      <template #body="{ data }">
        <div v-if="data.isHistory" class="queue-time-cell">
          {{ formatTime(data.executionTimeInSeconds) }}
        </div>
        <div v-else-if="data.isRunning" class="queue-time-cell">
          <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div v-else class="queue-time-cell">queued...</div>
      </template>
    </Column>
    <Column>
      <template #body="{ data }">
        <Button
          icon="pi pi-file-export"
          text
          severity="primary"
          @click="data.loadWorkflow()"
        />
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          @click="removeTask(data)"
        />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Button from "primevue/button";
import {
  TaskItemDisplayStatus,
  TaskItemImpl,
  useQueueStore,
} from "@/stores/queueStore";
import { computed, onMounted } from "vue";
import { api } from "@/scripts/api";

const queueStore = useQueueStore();
const tasks = computed(() => queueStore.tasks);
const taskTagSeverity = (status: TaskItemDisplayStatus) => {
  switch (status) {
    case TaskItemDisplayStatus.Pending:
      return "secondary";
    case TaskItemDisplayStatus.Running:
      return "info";
    case TaskItemDisplayStatus.Completed:
      return "success";
    case TaskItemDisplayStatus.Failed:
      return "danger";
    case TaskItemDisplayStatus.Cancelled:
      return "warning";
  }
};
const formatTime = (time?: number) => {
  if (time === undefined) {
    return "";
  }
  return `${time.toFixed(2)}s`;
};
const removeTask = (task: TaskItemImpl) => {
  if (task.isRunning) {
    api.interrupt();
  }
  queueStore.delete(task);
};
onMounted(() => {
  api.addEventListener("status", () => {
    queueStore.update();
  });

  queueStore.update();
});
</script>

<style scoped>
.queue-time-cell {
  min-width: 10ch;
}
</style>
