<script setup lang="ts">
import { computed } from 'vue'

import type { RunSlot } from '@/workbench/extensions/agent/services/agent/agentRunSlots'
import { runCardView } from '@/workbench/extensions/agent/services/agent/agentRunSlots'
import RunProgressCard from './RunProgressCard.vue'

const { runSlot } = defineProps<{ runSlot: RunSlot }>()

const view = computed(() => runCardView(runSlot))
</script>

<template>
  <RunProgressCard
    v-if="view !== 'hidden'"
    :view
    :duration-ms="runSlot.toolDurationMs"
  />
</template>
