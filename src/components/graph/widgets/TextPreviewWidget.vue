<template>
  <div
    class="relative w-full text-xs min-h-[28px] max-h-[200px] rounded-lg px-4 py-2 overflow-y-auto"
  >
    <div class="flex items-center gap-2">
      <div class="flex-1 break-all flex items-center gap-2">
        <span v-html="formattedText"></span>
        <Skeleton v-if="isParentNodeExecuting" class="!flex-1 !h-4" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'

import { NodeId } from '@/lib/litegraph/src/litegraph'
import { useExecutionStore } from '@/stores/executionStore'
import { linkifyHtml, nl2br } from '@/utils/formatUtil'

const modelValue = defineModel<string>({ required: true })
const props = defineProps<{
  widget?: object
  nodeId: NodeId
}>()

const executionStore = useExecutionStore()
const isParentNodeExecuting = ref(true)
const formattedText = computed(() => nl2br(linkifyHtml(modelValue.value)))

let parentNodeId: NodeId | null = null
onMounted(() => {
  // Get the parent node ID from props if provided
  // For backward compatibility, fall back to the first executing node
  parentNodeId = props.nodeId
})

// Watch for either a new node has starting execution or overall execution ending
const stopWatching = watch(
  [() => executionStore.executingNodeIds, () => executionStore.isIdle],
  () => {
    if (executionStore.isIdle) {
      isParentNodeExecuting.value = false
      stopWatching()
      return
    }

    // Check if parent node is no longer in the executing nodes list
    if (
      parentNodeId &&
      !executionStore.executingNodeIds.includes(parentNodeId)
    ) {
      isParentNodeExecuting.value = false
      stopWatching()
    }

    // Set parent node ID if not set yet
    if (!parentNodeId && executionStore.executingNodeIds.length > 0) {
      parentNodeId = executionStore.executingNodeIds[0]
    }
  }
)
</script>
