<template>
  <div
    class="w-full text-xs min-h-[28px] max-h-[200px] rounded-lg px-4 py-2 overflow-y-auto"
  >
    <Button
      v-if="!isParentNodeExecuting"
      icon="pi pi-copy"
      class="!absolute !top-2 !right-2 !p-1 !rounded-md hover:!bg-white/20 focus:!outline-none focus:!ring-2 focus:!ring-primary-500"
      :aria-label="$t('g.copyToClipboard')"
      text
      @click="copyText"
    />

    <div class="break-all pr-8 flex items-center gap-2">
      <span v-html="formattedText"></span>
      <Message
        v-if="showCopiedSuccessMessage"
        severity="success"
        class="absolute right-12 top-2 text-xs"
        :pt="{
          content: {
            class: '!p-1'
          }
        }"
        size="small"
      >
        {{ $t('clipboard.successMessage') }}
      </Message>
      <Skeleton v-if="isParentNodeExecuting" class="!flex-1 !h-4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NodeId } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { linkifyHtml, nl2br } from '@/utils/formatUtil'
import { extractFirstUrl } from '@/utils/networkUtil'

const COPIED_TOAST_DURATION = 756

const modelValue = defineModel<string>({ required: true })
defineProps<{
  widget?: object
}>()

const executionStore = useExecutionStore()
const isParentNodeExecuting = ref(true)
const showCopiedSuccessMessage = ref(false)
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

const copyText = () => {
  void navigator.clipboard.writeText(
    extractFirstUrl(modelValue.value) ?? modelValue.value
  )
  showCopiedSuccessMessage.value = true
  setTimeout(
    () => (showCopiedSuccessMessage.value = false),
    COPIED_TOAST_DURATION
  )
}
</script>
