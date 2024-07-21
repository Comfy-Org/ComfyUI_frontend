<template>
  <Accordion>
    <AccordionPanel v-for="task in tasks" :key="task.prompt.promptId">
      <AccordionHeader>
        <div>{{ task.prompt.queueIndex }} - {{ task.taskType }}</div>
      </AccordionHeader>
      <AccordionContent>
        <div>{{ task.prompt.promptInputs }}</div>
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

const queueStore = useQueueStore();
const tasks = queueStore.tasks;
</script>
