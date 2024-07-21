<template>
  <DataTable :value="tasks" dataKey="promptId">
    <Column header="#">
      <template #body="{ index }">
        {{ index + 1 }}
      </template>
    </Column>
    <Column header="STATUS">
      <template #body="{ data }">
        <Tag>
          {{ data.displayStatus }}
        </Tag>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import { useQueueStore } from "@/stores/queueStore";
import { computed, onMounted } from "vue";
import { api } from "@/scripts/api";

const queueStore = useQueueStore();
const tasks = computed(() => queueStore.tasks);

onMounted(() => {
  api.addEventListener("status", () => {
    queueStore.update();
  });

  queueStore.update();
});
</script>
