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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PromptEditor from '@/components/graph/widgets/PromptEditor.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { PromptTemplate } from '@/platform/prompts/promptTypes'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
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

function getNode(): LGraphNode | undefined {
  return canvasStore.canvas?.graph?.getNodeById(nodeId) ?? undefined
}

// --- Variable input sockets ----------------------------------------------
type VariableSyncNode = LGraphNode & {
  syncVariableInputs: (names: string[]) => void
}

function variableSyncNode(): VariableSyncNode | undefined {
  const node = getNode()
  return node && 'syncVariableInputs' in node
    ? (node as VariableSyncNode)
    : undefined
}

const variableNames = ref<string[]>([])
const connectedNames = ref<string[]>([])

function refreshSocketState() {
  const names = new Set<string>()
  const connected = new Set<string>()
  for (const input of getNode()?.inputs ?? []) {
    if (input.name) names.add(input.name)
    if (input.link != null && input.name) connected.add(input.name)
  }
  variableNames.value = [...names]
  connectedNames.value = [...connected]
}

// Reconcile when the node's sockets change — a connection made/removed updates
// resolved state, and renamed/added sockets update the available references.
watch(
  () =>
    (getNode()?.inputs ?? [])
      .map((input) => `${input.name ?? ''}:${input.link ?? ''}`)
      .join('|'),
  refreshSocketState,
  { immediate: true }
)

let lastVarKey = ''

/** Mirrors the variables declared in the editor onto the node as input sockets. */
function syncVariableInputs(template: PromptTemplate) {
  const node = variableSyncNode()
  if (!node) return
  const names: string[] = []
  for (const segment of template) {
    if (segment.type === 'var' && !names.includes(segment.name)) {
      names.push(segment.name)
    }
  }
  const key = JSON.stringify(names)
  if (key === lastVarKey) return
  lastVarKey = key
  node.syncVariableInputs(names)
}

watch(modelValue, (template) => syncVariableInputs(template ?? []), {
  immediate: true
})
</script>
