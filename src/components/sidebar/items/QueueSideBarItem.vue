<template>
  <DataTable
    v-if="tasks.length > 0"
    :value="tasks"
    dataKey="promptId"
    class="queue-table"
  >
    <Column header="STATUS">
      <template #body="{ data }">
        <Tag :severity="taskTagSeverity(data.displayStatus)">
          {{ data.displayStatus.toUpperCase() }}
        </Tag>
      </template>
    </Column>
    <Column header="TIME" :pt="{ root: { class: 'queue-time-cell' } }">
      <template #body="{ data }">
        <div v-if="data.isHistory" class="queue-time-cell-content">
          {{ formatTime(data.executionTimeInSeconds) }}
        </div>
        <div v-else-if="data.isRunning" class="queue-time-cell-content">
          <i class="pi pi-spin pi-spinner"></i>
        </div>
        <div v-else class="queue-time-cell-content">...</div>
      </template>
    </Column>
    <Column
      :pt="{
        headerCell: {
          class: 'queue-tool-header-cell',
        },
        bodyCell: {
          class: 'queue-tool-body-cell',
        },
      }"
    >
      <template #header>
        <Toast />
        <ConfirmPopup />
        <Button
          icon="pi pi-trash"
          text
          severity="primary"
          @click="confirmRemoveAll($event)"
        />
      </template>
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
  <div>
    <Message icon="pi pi-info" severity="error">
      <span class="ml-2">No tasks</span>
    </Message>
  </div>
</template>

<script setup lang="ts">
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Button from "primevue/button";
import ConfirmPopup from "primevue/confirmpopup";
import Toast from "primevue/toast";
import Message from "primevue/message";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import {
  TaskItemDisplayStatus,
  TaskItemImpl,
  useQueueStore,
} from "@/stores/queueStore";
import { computed, onMounted } from "vue";
import { api } from "@/scripts/api";

const confirm = useConfirm();
const toast = useToast();
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
const removeAllTasks = async () => {
  await queueStore.clear();
};
const confirmRemoveAll = (event) => {
  confirm.require({
    target: event.currentTarget,
    message: "Do you want to delete all tasks?",
    icon: "pi pi-info-circle",
    rejectProps: {
      label: "Cancel",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Delete",
      severity: "danger",
    },
    accept: async () => {
      await removeAllTasks();
      toast.add({
        severity: "info",
        summary: "Confirmed",
        detail: "Tasks deleted",
        life: 3000,
      });
    },
  });
};
onMounted(() => {
  api.addEventListener("status", () => {
    queueStore.update();
  });

  queueStore.update();
});
</script>

<style>
.queue-tool-header-cell {
  display: flex;
  justify-content: flex-end;
}

.queue-tool-body-cell {
  display: table-cell;
  text-align: right !important;
}
</style>

<style scoped>
.queue-time-cell-content {
  width: fit-content;
}

.queue-table {
  height: 100%;
  overflow-y: auto;
}
</style>
