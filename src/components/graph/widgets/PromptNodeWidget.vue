<template>
  <div
    class="flex size-full min-h-[100px] flex-col text-xs"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @wheel.stop
  >
    <div class="min-h-0 flex-1">
      <PromptEditor
        v-model="modelValue"
        :variable-names
        :connected-names
        :placeholder="t('promptNode.editorPlaceholder')"
        :readonly="isReadOnly"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PromptEditor from '@/components/graph/widgets/PromptEditor.vue'
import type { PromptTemplate } from '@/platform/prompts/promptTemplate'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeId } = defineProps<{
  widget?: SimplifiedWidget<PromptTemplate>
  nodeId: string
}>()

const modelValue = defineModel<PromptTemplate>({ default: () => [] })

const { t } = useI18n()
const canvasStore = useCanvasStore()

const isReadOnly = computed(() =>
  Boolean(widget?.options?.read_only || widget?.options?.disabled)
)

const inputSockets = computed(
  () => canvasStore.canvas?.graph?.getNodeById(toNodeId(nodeId))?.inputs ?? []
)
const variableNames = computed(() =>
  inputSockets.value.flatMap((input) => (input.name ? [input.name] : []))
)
const connectedNames = computed(() =>
  inputSockets.value.flatMap((input) =>
    input.name && input.link != null ? [input.name] : []
  )
)
</script>
