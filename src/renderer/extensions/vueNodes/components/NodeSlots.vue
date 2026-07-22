<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ st('nodeErrors.slots', 'Node Slots Error') }}
  </div>
  <div v-else :class="cn('flex min-w-0 justify-between', unifiedWrapperClass)">
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
      v-if="liveOutputs.length"
      :class="cn('ml-auto flex min-w-0 flex-col', unifiedDotsClass)"
    >
      <OutputSlot
        v-for="(output, index) in liveOutputs"
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
import { computed, onErrorCaptured, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  linkedWidgetedInputs,
  nonWidgetedInputs
} from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import type { NodeState } from '@/types/nodeState'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId,
  subgraphIdFromGraphId
} from '@/utils/graphTraversalUtil'
import { cn } from '@comfyorg/tailwind-utils'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

interface NodeSlotsProps {
  nodeData: NodeState
  unified?: boolean
  /** Slot overrides for synthetic nodes with no live graph node (previews). */
  inputs?: INodeInputSlot[]
  outputs?: INodeOutputSlot[]
}

const {
  nodeData,
  unified = false,
  inputs,
  outputs
} = defineProps<NodeSlotsProps>()
const canvasStore = useCanvasStore()
const executionErrorStore = useExecutionErrorStore()
const linkStore = useLinkStore()
const nodeLocatorId = computed(() =>
  getLocatorIdFromNodeData({
    id: nodeData.id,
    subgraphId: subgraphIdFromGraphId(nodeData.graphId, canvasStore.rootGraphId)
  })
)

const liveNode = computed(() => {
  const locatorId = nodeLocatorId.value
  const rootGraph = app.isGraphReady ? app.rootGraph : null
  return locatorId && rootGraph
    ? getNodeByLocatorId(rootGraph, locatorId)
    : null
})
const liveInputs = computed(() => inputs ?? liveNode.value?.inputs)
const liveOutputs = computed(() => outputs ?? liveNode.value?.outputs ?? [])

const linkedWidgetInputs = computed(() =>
  unified && canvasStore.rootGraphId
    ? linkedWidgetedInputs(
        nodeData.id,
        liveInputs.value,
        canvasStore.rootGraphId
      )
    : []
)

function isInputConnected(index: number): boolean {
  const graphId = canvasStore.rootGraphId
  if (graphId === undefined) return false
  return linkStore.isInputSlotConnected(graphId, nodeData.id, index)
}

function isOutputConnected(index: number): boolean {
  const graphId = canvasStore.rootGraphId
  if (graphId === undefined) return false
  return linkStore.isOutputSlotConnected(graphId, nodeData.id, index)
}

const filteredInputs = computed(() => [
  ...nonWidgetedInputs(liveInputs.value),
  ...linkedWidgetInputs.value
])

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
const getActualInputIndex = (
  input: INodeSlot,
  filteredIndex: number
): number => {
  const inputs = liveInputs.value
  if (!inputs) return filteredIndex

  // Find the actual index in the unfiltered inputs array
  const actualIndex = inputs.findIndex((i) => i === input)
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
