<template>
  <div
    v-if="groups.length > 0"
    class="overflow-hidden rounded-lg border border-secondary not-first:mt-3"
  >
    <ErrorCardSection
      v-model:collapse="collapse"
      data-testid="deprecated-nodes-group"
      :title="t('nodeReplacement.deprecatedNodesTitle')"
      :count="groups.length"
      severity="notice"
    >
      <div class="flex flex-col items-start gap-2 px-3 pb-2">
        <p class="m-0 text-xs/relaxed text-muted-foreground">
          {{ t('nodeReplacement.deprecatedNodesMessage') }}
        </p>
        <Button
          :tooltip="t('nodeReplacement.replaceAllWarning')"
          variant="secondary"
          size="sm"
          @click="replaceAllGroups(groups)"
        >
          {{ t('nodeReplacement.replaceAll') }}
        </Button>
      </div>
      <SwapNodesCard
        :swap-node-groups="groups"
        :highlighted-node-ids
        @locate-node="emit('locate-node', $event)"
        @replace="replaceGroup"
      />
    </ErrorCardSection>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useI18n } from 'vue-i18n'

import SwapNodesCard from '@/platform/workflowErrors/nodeReplacement/components/SwapNodesCard.vue'
import { useNodeReplacement } from '@/platform/workflowErrors/nodeReplacement/useNodeReplacement'
import ErrorCardSection from '@/platform/workflowErrors/panel/ErrorCardSection.vue'
import type { SwapNodeGroup } from '@/platform/workflowErrors/panel/useErrorGroups'

const { groups } = defineProps<{
  groups: SwapNodeGroup[]
  highlightedNodeIds?: Set<string>
}>()

const collapse = defineModel<boolean>('collapse', { default: false })

const emit = defineEmits<{
  'locate-node': [nodeId: string]
}>()

const { t } = useI18n()
const { replaceGroup, replaceAllGroups } = useNodeReplacement()
</script>
