<template>
  <Accordion>
    <AccordionPanel v-for="task in tasks" :key="task.promptId">
      <AccordionHeader>
        <div>{{ task.queueIndex }} - {{ task.taskType }}</div>
      </AccordionHeader>
      <AccordionContent>
        <div>{{ task.promptInputs }}</div>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<script setup lang="ts">
import { useQueueStore } from "@/stores/queueStore";
import Accordion from "primevue/accordion";
import AccordionHeader from "primevue/accordionheader";
import AccordionPanel from "primevue/accordionpanel";
import AccordionContent from "primevue/accordioncontent";
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
