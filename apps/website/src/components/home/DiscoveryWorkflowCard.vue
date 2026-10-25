<script setup lang="ts">
import type { DiscoveryWorkflow } from '@/data/modelDiscovery'
import StaticFrame from '@/components/workshop/StaticFrame.vue'

// A provider stands for a body of work and says so with its mark; a workflow
// stands for one finished job, so it leads with the job.
const { workflow } = defineProps<{ workflow: DiscoveryWorkflow }>()
</script>

<template>
  <a>
    <StaticFrame
      :src="workflow.thumbnailUrl"
      class="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
    />
    <span
      class="absolute inset-0 bg-linear-to-t from-black/80 to-transparent transition-colors group-focus-within/card:from-black group-focus-within/card:via-black/70 group-hover/card:from-black group-hover/card:via-black/70"
      aria-hidden="true"
    />
    <!-- The card has a side inset and no vertical one, so the name has to
      carry its own or it sits on the bottom edge. -->
    <span
      :title="workflow.name"
      class="relative mt-auto block w-full truncate pb-5 text-left text-sm/tight font-medium group-focus-within/card:whitespace-normal group-hover/card:whitespace-normal"
    >
      {{ workflow.name }}
    </span>
  </a>
</template>
