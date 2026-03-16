<template>
  <div class="mt-2 px-4 pb-2">
    <!-- Sub-label: guidance message shown above all swap groups -->
    <p class="m-0 pb-5 text-sm/relaxed text-muted-foreground">
      {{
        t(
          'nodeReplacement.swapNodesGuide',
          'The following nodes can be automatically replaced with compatible alternatives.'
        )
      }}
    </p>
    <!-- Group Rows -->
    <SwapNodeGroupRow
      v-for="group in swapNodeGroups"
      :key="group.type"
      :group="group"
      :show-node-id-badge="showNodeIdBadge"
      @locate-node="emit('locate-node', $event)"
      @replace="emit('replace', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import SwapNodeGroupRow from '@/platform/nodeReplacement/components/SwapNodeGroupRow.vue'

const { t } = useI18n()

const { swapNodeGroups, showNodeIdBadge } = defineProps<{
  swapNodeGroups: SwapNodeGroup[]
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  'locate-node': [nodeId: string]
  replace: [group: SwapNodeGroup]
}>()
</script>
