<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.slots', 'Node Slots Error') }}
  </div>
  <div
    v-else
    ref="slots"
    :class="cn('flex min-w-0 justify-between', unifiedWrapperClass)"
  >
    <div
      v-if="filteredInputs.length"
      :class="cn('flex min-w-0 flex-col', unifiedDotsClass)"
    >
      <InputSlot
        v-for="(input, index) in filteredInputs"
        :key="`input-${input.name}-${getActualInputIndex(input, index)}`"
        :slot-data="input"
        :node-type="nodeData?.type || ''"
        :node-id="nodeData.id"
        :has-error="inputHasError(input)"
        :index="getActualInputIndex(input, index)"
        :connected="isInputConnected(getActualInputIndex(input, index))"
      />
    </div>

    <div
      v-if="nodeData.outputs.length"
      :class="cn('ml-auto flex min-w-0 flex-col', unifiedDotsClass)"
    >
      <OutputSlot
        v-for="(output, index) in nodeData.outputs"
        :key="`output-${output.name}-${index}`"
        :slot-data="output"
        :node-type="nodeData?.type || ''"
        :node-id="nodeData.id"
        :index="index"
        :connected="isOutputConnected(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, useTemplateRef, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import {
  linkedWidgetedInputs,
  nonWidgetedInputs
} from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import type { GraphScope } from '@/types/graphScopeId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { NodeState } from '@/types/nodeState'
import { locatorIdFromState } from '@/utils/graphTraversalUtil'
import { cn } from '@comfyorg/tailwind-utils'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

const {
  nodeData,
  unified = false,
  syncLayout = true
} = defineProps<{
  nodeData: NodeState
  unified?: boolean
  syncLayout?: boolean
}>()
const canvasStore = useCanvasStore()
const slots = useTemplateRef<HTMLElement>('slots')
const executionErrorStore = useExecutionErrorStore()
const linkStore = useLinkStore()
const nodeLocatorId = computed(() =>
  locatorIdFromState(nodeData, canvasStore.rootGraphId)
)
const nodeScope = computed<GraphScope | null>(() => {
  const graph = canvasStore.currentGraph
  return graph
    ? {
        rootGraphId: toRootGraphId(graph.rootGraph.id),
        owningGraphId: toOwningGraphId(nodeData.graphId)
      }
    : null
})

const linkedWidgetInputs = computed(() =>
  unified && nodeScope.value
    ? linkedWidgetedInputs(nodeData.id, nodeData.inputs, nodeScope.value)
    : []
)

function isInputConnected(index: number): boolean {
  const scope = nodeScope.value
  if (!scope) return false
  return linkStore.isInputSlotConnected(scope, nodeData.id, index)
}

function isOutputConnected(index: number): boolean {
  const scope = nodeScope.value
  if (!scope) return false
  return linkStore.isOutputSlotConnected(scope, nodeData.id, index)
}

const filteredInputs = computed(() => [
  ...nonWidgetedInputs(nodeData.inputs),
  ...linkedWidgetInputs.value
])

const layoutKey = computed(() =>
  [
    ...filteredInputs.value.map((input, index) =>
      getActualInputIndex(input, index)
    ),
    '|',
    ...nodeData.outputs.keys(),
    unified
  ].join(':')
)

watch(
  [layoutKey, slots, () => canvasStore.rootGraphId],
  () => {
    const rootGraphId = canvasStore.rootGraphId
    if (syncLayout && slots.value && rootGraphId) {
      syncSlotOffsets(slots.value, rootGraphId, nodeData.id)
    }
  },
  { flush: 'post' }
)

function inputHasError(input: INodeSlot): boolean {
  const locatorId = nodeLocatorId.value
  if (!locatorId) return false

  return executionErrorStore.slotHasError(locatorId, input.name)
}

const unifiedWrapperClass = computed((): string =>
  cn(
    unified &&
      'pointer-events-none absolute inset-0 z-30 items-center opacity-0'
  )
)
const unifiedDotsClass = computed((): string =>
  cn(
    unified &&
      'grid grid-cols-1 grid-rows-1 place-items-center gap-0 *:col-span-full *:row-span-full'
  )
)

// Get the actual index of an input slot in the node's inputs array
// (accounting for filtered widget slots)
function getActualInputIndex(input: INodeSlot, filteredIndex: number): number {
  const actualIndex = nodeData.inputs.findIndex((i) => i === input)
  return actualIndex !== -1 ? actualIndex : filteredIndex
}

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
