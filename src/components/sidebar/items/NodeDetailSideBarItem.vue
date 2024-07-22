<template>
  <Accordion>
    <AccordionPanel v-for="node in nodes" :key="node.id">
      <AccordionHeader>
        <div>{{ node.id }} - {{ node.type }}</div>
      </AccordionHeader>
    </AccordionPanel>
  </Accordion>
</template>

<script setup lang="ts">
import { defaultGraph } from "@/scripts/defaultGraph";
import Accordion from "primevue/accordion";
import AccordionHeader from "primevue/accordionheader";
import AccordionPanel from "primevue/accordionpanel";

/* Placeholder workflow display */
const workflow = defaultGraph;
const nodes = workflow.nodes.sort((a, b) => a.id - b.id);
</script>
