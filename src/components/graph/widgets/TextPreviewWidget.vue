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
import { NodeId } from '@comfyorg/litegraph'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { linkifyHtml, nl2br } from '@/utils/formatUtil'

const modelValue = defineModel<string>({ required: true })
defineProps<{
  widget?: object
}>()

const executionStore = useExecutionStore()
const isParentNodeExecuting = ref(true)
const formattedText = computed(() => nl2br(linkifyHtml(modelValue.value)))

let executingNodeId: NodeId | null = null
onMounted(() => {
  executingNodeId = executionStore.executingNodeId
})

// Watch for either a new node has starting execution or overall execution ending
const stopWatching = watch(
  [() => executionStore.executingNode, () => executionStore.isIdle],
  () => {
    if (
      executionStore.isIdle ||
      (executionStore.executingNode &&
        executionStore.executingNode.id !== executingNodeId)
    ) {
      isParentNodeExecuting.value = false
      stopWatching()
    }
    if (!executingNodeId) {
      executingNodeId = executionStore.executingNodeId
    }
  }
)
</script>
