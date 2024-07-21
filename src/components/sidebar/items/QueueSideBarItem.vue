<template>
  <DataTable :value="tasks" dataKey="promptId">
    <Column header="STATUS">
      <template #body="{ data }">
        <Tag :severity="taskTagSeverity(data.displayStatus)">
          {{ data.displayStatus.toUpperCase() }}
        </Tag>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import { TaskItemDisplayStatus, useQueueStore } from "@/stores/queueStore";
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

onMounted(() => {
  api.addEventListener("status", () => {
    queueStore.update();
  });

  queueStore.update();
});
</script>
