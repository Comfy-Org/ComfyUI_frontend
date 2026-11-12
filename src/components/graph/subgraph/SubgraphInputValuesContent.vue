<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SingleSelect from '@comfyorg/design-system/single-select/SingleSelect'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'
import { useSubgraphInputValues } from './useSubgraphInputValues'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'
import SubgraphInputValue from './SubgraphInputValue.vue'

const { t } = useI18n()
const context = useSubgraphInputValuesStore()
const navigation = useSubgraphNavigationStore()
const canvasStore = useCanvasStore()
const { rows, resolve, isShared } = useSubgraphInputValues()
const options = computed(() =>
  context.candidates.map((node) => ({
    value: `${node.graphId}:${node.id}`,
    name: t('subgraphInputValues.instance', { title: node.title, id: node.id })
  }))
)
const selectedKey = computed({
  get: () =>
    context.selected
      ? `${context.selected.graphId}:${context.selected.id}`
      : undefined,
  set: (value: string | number | undefined) => {
    const host = context.candidates.find(
      (node) => `${node.graphId}:${node.id}` === value
    )
    if (host) context.selectHost(host)
  }
})

async function locate(node: NodeState) {
  const root = context.graph?.rootGraph
  const owner = root && getNodeByState(root, node)
  const canvas = canvasStore.canvas
  if (!owner?.graph || !canvas) return
  if (await navigation.navigateToGraph(owner.graph)) {
    canvas.animateToBounds(owner.boundingRect)
  }
}
const graphName = computed(() => {
  const root = context.graph?.rootGraph
  const ownerId = context.selected?.graphId
  return root && ownerId === root.id
    ? t('subgraphInputValues.workflow')
    : root?.subgraphs.get(ownerId ?? '')?.name
})
</script>

<template>
  <div class="space-y-3 p-3">
    <div class="space-y-1">
      <label
        for="subgraph-input-host"
        class="block text-xs text-muted-foreground"
        >{{ t('subgraphInputValues.editingInstance') }}</label
      >
      <SingleSelect
        id="subgraph-input-host"
        v-model="selectedKey"
        :options
        :label="t('subgraphInputValues.chooseInstance')"
        :accessible-label="t('subgraphInputValues.editingInstance')"
        class="w-full"
      />
      <p
        v-if="context.selected"
        class="m-0 truncate text-xs text-muted-foreground"
      >
        {{ t('subgraphInputValues.inGraph', { graph: graphName }) }}
      </p>
    </div>
    <template v-if="context.selected">
      <SubgraphInputValue
        v-for="row in rows"
        :key="`${selectedKey}:${row.name}`"
        :label="row.label"
        :host="context.selected"
        :shared="isShared(row.name)"
        :resolve="() => resolve(row.name)"
        @locate="locate"
      />
      <p v-if="!rows.length" class="m-0 text-xs text-muted-foreground">
        {{ t('subgraphInputValues.noInputs') }}
      </p>
    </template>
    <p v-else class="m-0 text-xs text-muted-foreground">
      {{ t('subgraphInputValues.chooseInstanceHint') }}
    </p>
  </div>
</template>
