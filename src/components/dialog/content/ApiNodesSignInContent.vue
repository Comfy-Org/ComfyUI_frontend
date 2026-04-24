<template>
  <div
    data-testid="api-signin-dialog"
    class="flex max-h-144 max-w-96 flex-col gap-4 p-2"
  >
    <h2 class="mb-2 text-2xl font-medium">
      {{ t('apiNodesSignInDialog.title') }}
    </h2>

    <div class="mb-4 text-base">
      {{ t('apiNodesSignInDialog.message') }}
    </div>

    <ApiNodesList :nodes="apiNodes" :total="aggregateTotal" />

    <div class="flex items-center justify-between">
      <Button variant="textonly" @click="handleLearnMoreClick">
        {{ t('g.learnMore') }}
      </Button>
      <div class="flex gap-2">
        <Button variant="secondary" @click="onCancel?.()">
          {{ t('g.cancel') }}
        </Button>
        <Button @click="onLogin?.()">
          {{ t('g.login') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ApiNodesList from '@/components/common/ApiNodesList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useApiNodeRows } from '@/composables/node/useApiNodeRows'
import {
  formatAggregateTotal,
  useGraphCostAggregator
} from '@/composables/node/useGraphCostAggregator'
import { useExternalLink } from '@/composables/useExternalLink'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()

const { apiNodeNames, graph, onLogin, onCancel } = defineProps<{
  apiNodeNames: string[]
  /**
   * Getter that resolves the graph whose api-nodes this dialog renders.
   * The caller owns whatever fallback it needs (e.g. `app.rootGraph`);
   * keeping the resolution at the call site scopes the ambient-global
   * coupling to one place, and the getter shape lets the dialog's
   * composables re-read on every invalidation.
   */
  graph: () => LGraph | Subgraph | null
  onLogin?: () => void
  onCancel?: () => void
}>()

const aggregate = useGraphCostAggregator(graph)
const apiNodesFromGraph = useApiNodeRows(graph)

const apiNodes = computed(() => {
  if (apiNodesFromGraph.value.length > 0) return apiNodesFromGraph.value
  // No graph / no api-nodes: surface the prop-supplied names. Key
  // includes the index so duplicate names (two instances of the same
  // node type) don't collide on Vue's :key.
  return apiNodeNames.map((name, index) => ({
    id: `${name}#${index}`,
    name,
    cost: null
  }))
})

const aggregateTotal = computed(() => formatAggregateTotal(aggregate.value, t))

const handleLearnMoreClick = () => {
  window.open(
    buildDocsUrl('/tutorials/api-nodes/faq', { includeLocale: true }),
    '_blank'
  )
}
</script>
