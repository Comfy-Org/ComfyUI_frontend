<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { AskNodeRef } from '../../../services/agent/agentMessageParts'

const { nodes, hiddenCount } = defineProps<{
  nodes: AskNodeRef[]
  hiddenCount: number
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex flex-col gap-1 rounded-md bg-component-node-background p-2 text-xs/5"
  >
    <ul
      :aria-label="t('agent.deleteApproval.nodes')"
      class="m-0 flex max-h-40 list-none flex-col gap-0.5 overflow-y-auto p-0"
    >
      <li
        v-for="node in nodes"
        :key="node.id"
        class="flex min-w-0 items-baseline gap-2"
      >
        <span v-if="node.name" class="truncate text-base-foreground">
          {{ node.name }}
        </span>
        <span class="max-w-1/2 shrink-0 truncate text-muted-foreground">
          {{ t('agent.deleteApproval.nodeId', { id: node.id }) }}
        </span>
      </li>
    </ul>
    <p v-if="hiddenCount > 0" class="m-0 text-muted-foreground">
      {{ t('agent.deleteApproval.moreNodes', hiddenCount) }}
    </p>
  </div>
</template>
