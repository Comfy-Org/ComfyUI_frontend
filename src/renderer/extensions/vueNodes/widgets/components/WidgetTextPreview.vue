<template>
  <div class="widget-text-preview group relative w-full">
    <div
      class="invisible absolute top-1.5 right-1.5 z-10 flex gap-1 group-focus-within:visible group-hover:visible"
    >
      <Button
        variant="textonly"
        size="icon"
        class="hover:bg-base-foreground/10"
        :title="$t('g.copyToClipboard')"
        :aria-label="$t('g.copyToClipboard')"
        @click="handleCopy"
        @pointerdown.capture.stop
      >
        <i class="icon-[lucide--copy] size-4 text-component-node-foreground" />
      </Button>
      <Button
        v-if="downloadUrl"
        variant="textonly"
        size="icon"
        class="hover:bg-base-foreground/10"
        :title="$t('g.download')"
        :aria-label="$t('g.download')"
        @click="handleDownload"
        @pointerdown.capture.stop
      >
        <i
          class="icon-[lucide--download] size-4 text-component-node-foreground"
        />
      </Button>
    </div>

    <div
      v-if="showMarkdown"
      class="comfy-markdown-content size-full min-h-[60px] overflow-y-auto rounded-lg text-sm"
      data-capture-wheel="true"
      role="textarea"
      :aria-label="widget.name"
      aria-readonly="true"
      v-html="renderedMarkdown"
    />
    <Textarea
      v-else
      :model-value="modelValue"
      readonly
      :aria-label="widget.name"
      :class="
        cn(
          WidgetInputBaseClass,
          'size-full resize-none text-(length:--comfy-textarea-font-size) leading-normal',
          // Keep overflow stable so the scrollbar-gutter (from the base
          // Textarea) stays reserved; a hover overflow toggle would reflow the
          // content when the gutter appears.
          'overflow-y-auto'
        )
      "
      data-capture-wheel="true"
      @pointerdown.capture.stop
      @pointermove.capture.stop
      @pointerup.capture.stop
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { downloadFile } from '@/base/common/downloadUtil'
import type { NodeOutputWith, ResultItem } from '@/schemas/apiSchema'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { resolveNode } from '@/utils/litegraphUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'

type SaveTextOutput = NodeOutputWith<{
  files?: ResultItem[]
}>

const MODE_WIDGET_NAME = 'preview_mode'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<string>
  nodeId?: NodeId
}>()

const modelValue = defineModel<string>({ default: '' })

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const canvasStore = useCanvasStore()
const widgetValueStore = useWidgetValueStore()
const nodeOutputStore = useNodeOutputStore()
const { nodeToNodeLocatorId } = useWorkflowStore()

const localNodeId = computed(() =>
  nodeId === undefined ? null : stripGraphPrefix(nodeId)
)

const showMarkdown = computed<boolean>(() => {
  const graphId = canvasStore.canvas?.graph?.rootGraph.id
  if (!graphId || localNodeId.value === null) return false
  return (
    widgetValueStore.getWidget(graphId, localNodeId.value, MODE_WIDGET_NAME)
      ?.value === true
  )
})

const renderedMarkdown = computed(() =>
  showMarkdown.value ? renderMarkdownToHtml(modelValue.value || '') : ''
)

const savedFile = computed(() => {
  if (nodeId === undefined) return undefined
  const node = resolveNode(nodeId)
  if (!node) return undefined
  const outputs = nodeOutputStore.nodeOutputs[nodeToNodeLocatorId(node)] as
    | SaveTextOutput
    | undefined
  return outputs?.files?.[0]
})

const downloadUrl = computed(() => {
  const file = savedFile.value
  if (!file?.filename) return undefined
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder ?? '',
    type: file.type ?? 'output'
  })
  return api.apiURL(`/view?${params}`)
})

function handleCopy() {
  void copyToClipboard(modelValue.value)
}

function handleDownload() {
  if (!downloadUrl.value) return
  try {
    downloadFile(downloadUrl.value, savedFile.value?.filename)
  } catch {
    useToastStore().add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('g.failedToDownloadFile')
    })
  }
}
</script>
