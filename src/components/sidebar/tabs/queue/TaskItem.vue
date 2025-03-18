<template>
  <div class="task-item" @contextmenu="handleContextMenu">
    <div class="task-result-preview">
      <template
        v-if="
          task.displayStatus === TaskItemDisplayStatus.Completed ||
          cancelledWithResults
        "
      >
        <ResultItem
          v-if="flatOutputs.length && coverResult"
          :result="coverResult"
          @preview="handlePreview"
        />
      </template>
      <template v-if="task.displayStatus === TaskItemDisplayStatus.Running">
        <i v-if="!progressPreviewBlobUrl" class="pi pi-spin pi-spinner"></i>
        <img
          v-else
          :src="progressPreviewBlobUrl"
          class="progress-preview-img"
        />
      </template>
      <span v-else-if="task.displayStatus === TaskItemDisplayStatus.Pending"
        >...</span
      >
      <i
        v-else-if="cancelledWithoutResults"
        class="pi pi-exclamation-triangle"
      ></i>
      <i
        v-else-if="task.displayStatus === TaskItemDisplayStatus.Failed"
        class="pi pi-exclamation-circle"
      ></i>
    </div>

    <div class="task-item-details">
      <div class="tag-wrapper status-tag-group">
        <Tag v-if="isFlatTask && task.isHistory" class="node-name-tag">
          <Button
            class="task-node-link"
            :label="`${node?.type} (#${node?.id})`"
            link
            size="small"
            @click="
              () => {
                if (!node) return
                litegraphService.goToNode(node.id)
              }
            "
          />
        </Tag>
        <Tag :severity="taskTagSeverity(task.displayStatus)">
          <span v-html="taskStatusText(task.displayStatus)"></span>
          <span v-if="task.isHistory" class="task-time">
            {{ formatTime(task.executionTimeInSeconds) }}
          </span>
          <span v-if="isFlatTask" class="task-prompt-id">
            {{ task.promptId.split('-')[0] }}
          </span>
        </Tag>
      </div>
      <div class="tag-wrapper">
        <Button
          v-if="task.isHistory && flatOutputs.length > 1"
          outlined
          @click="handleOutputLengthClick"
        >
          <span style="font-weight: bold">{{ flatOutputs.length }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { ComfyNode } from '@/schemas/comfyWorkflowSchema'
import { api } from '@/scripts/api'
import { useLitegraphService } from '@/services/litegraphService'
import { TaskItemDisplayStatus, type TaskItemImpl } from '@/stores/queueStore'

import ResultItem from './ResultItem.vue'

const props = defineProps<{
  task: TaskItemImpl
  isFlatTask: boolean
}>()

const litegraphService = useLitegraphService()

const flatOutputs = props.task.flatOutputs
const coverResult = flatOutputs.length
  ? props.task.previewOutput || flatOutputs[0]
  : null
// Using `==` instead of `===` because NodeId can be a string or a number
const node: ComfyNode | null =
  flatOutputs.length && props.task.workflow
    ? props.task.workflow.nodes.find(
        (n: ComfyNode) => n.id == coverResult?.nodeId
      ) ?? null
    : null
const progressPreviewBlobUrl = ref('')

const emit = defineEmits<{
  (
    e: 'contextmenu',
    value: { task: TaskItemImpl; event: MouseEvent; node: ComfyNode | null }
  ): void
  (e: 'preview', value: TaskItemImpl): void
  (e: 'task-output-length-clicked', value: TaskItemImpl): void
}>()

onMounted(() => {
  api.addEventListener('b_preview', onProgressPreviewReceived)
})

onUnmounted(() => {
  if (progressPreviewBlobUrl.value) {
    URL.revokeObjectURL(progressPreviewBlobUrl.value)
  }
  api.removeEventListener('b_preview', onProgressPreviewReceived)
})

const handleContextMenu = (e: MouseEvent) => {
  emit('contextmenu', { task: props.task, event: e, node })
}

const handlePreview = () => {
  emit('preview', props.task)
}

const handleOutputLengthClick = () => {
  emit('task-output-length-clicked', props.task)
}

const taskTagSeverity = (status: TaskItemDisplayStatus) => {
  switch (status) {
    case TaskItemDisplayStatus.Pending:
      return 'secondary'
    case TaskItemDisplayStatus.Running:
      return 'info'
    case TaskItemDisplayStatus.Completed:
      return 'success'
    case TaskItemDisplayStatus.Failed:
      return 'danger'
    case TaskItemDisplayStatus.Cancelled:
      return 'warn'
  }
}

const taskStatusText = (status: TaskItemDisplayStatus) => {
  switch (status) {
    case TaskItemDisplayStatus.Pending:
      return 'Pending'
    case TaskItemDisplayStatus.Running:
      return '<i class="pi pi-spin pi-spinner" style="font-weight: bold"></i> Running'
    case TaskItemDisplayStatus.Completed:
      return '<i class="pi pi-check" style="font-weight: bold"></i>'
    case TaskItemDisplayStatus.Failed:
      return 'Failed'
    case TaskItemDisplayStatus.Cancelled:
      return 'Cancelled'
  }
}

const formatTime = (time?: number) => {
  if (time === undefined) {
    return ''
  }
  return `${time.toFixed(2)}s`
}

const onProgressPreviewReceived = async ({ detail }: CustomEvent) => {
  if (props.task.displayStatus === TaskItemDisplayStatus.Running) {
    if (progressPreviewBlobUrl.value) {
      URL.revokeObjectURL(progressPreviewBlobUrl.value)
    }
    progressPreviewBlobUrl.value = URL.createObjectURL(detail)
  }
}

const cancelledWithResults = computed(() => {
  return (
    props.task.displayStatus === TaskItemDisplayStatus.Cancelled &&
    flatOutputs.length
  )
})

const cancelledWithoutResults = computed(() => {
  return (
    props.task.displayStatus === TaskItemDisplayStatus.Cancelled &&
    flatOutputs.length === 0
  )
})
</script>

<style scoped>
.task-result-preview {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.task-result-preview i,
.task-result-preview span {
  font-size: 2rem;
}

.task-item {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.task-item-details {
  position: absolute;
  bottom: 0;
  padding: 0.6rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  z-index: 1;
}

.task-node-link {
  padding: 2px;
}

/* In dark mode, transparent background color for tags is not ideal for tags that
are floating on top of images. */
.tag-wrapper {
  background-color: var(--p-primary-contrast-color);
  border-radius: 6px;
  display: inline-flex;
}

.node-name-tag {
  word-break: break-all;
}

.status-tag-group {
  display: flex;
  flex-direction: column;
}

.progress-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
</style>
