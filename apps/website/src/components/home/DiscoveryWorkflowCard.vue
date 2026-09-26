<script setup lang="ts">
import type { DiscoveryWorkflow } from '../../data/modelDiscovery'
import StaticFrame from '../workshop/StaticFrame.vue'

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
      class="absolute inset-0 bg-linear-to-t from-black/80 to-transparent"
      aria-hidden="true"
    />
    <span class="relative mt-auto w-full text-base/tight font-medium">
      {{ workflow.name }}
    </span>
  </a>
</template>
