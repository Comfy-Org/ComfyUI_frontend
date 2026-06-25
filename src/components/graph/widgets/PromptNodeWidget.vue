<template>
  <div
    class="flex size-full min-h-[180px] flex-col gap-1 text-xs"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @wheel.stop
  >
    <div class="flex items-center gap-1">
      <SearchAutocomplete
        v-model="search"
        class="min-w-0 flex-1"
        input-class="bg-component-node-widget-background"
        size="sm"
        :placeholder="t('promptNode.searchPlaceholder')"
        :suggestions="promptSuggestions"
        option-label="name"
        option-key="id"
        @select="loadPrompt"
      />
      <Button
        size="icon-sm"
        variant="textonly"
        :title="t('promptNode.managerButton')"
        @click="openManager"
      >
        <i class="icon-[lucide--library] size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="textonly"
        :title="t('promptNode.saveAsPrompt')"
        @click="toggleSave"
      >
        <i class="icon-[lucide--save] size-4" />
      </Button>
    </div>

    <div
      v-if="showSave"
      class="flex items-center gap-1"
      @keydown.enter.stop.prevent="confirmSave"
      @keydown.escape.stop.prevent="showSave = false"
    >
      <input
        ref="nameInputEl"
        v-model="saveName"
        class="min-w-0 flex-1 rounded-sm border border-border-default bg-base-background px-2 py-1 outline-none"
        :placeholder="t('promptNode.namePlaceholder')"
      />
      <Button
        size="sm"
        :disabled="!canSave"
        :loading="isSaving"
        @click="confirmSave"
      >
        {{ t('g.save') }}
      </Button>
    </div>

    <div class="min-h-0 flex-1">
      <PromptEditor
        v-model="modelValue"
        :variable-names="variableNames"
        :connected-names="connectedNames"
        :allow-create-variable="true"
        :placeholder="t('promptNode.editorPlaceholder')"
        :readonly="isReadOnly"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PromptManagerDialogContent from '@/components/dialog/content/PromptManagerDialogContent.vue'
import PromptEditor from '@/components/prompts/PromptEditor.vue'
import Button from '@/components/ui/button/Button.vue'
import SearchAutocomplete from '@/components/ui/search-input/SearchAutocomplete.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  Prompt,
  PromptTemplate
} from '@/platform/prompts/schemas/promptTypes'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  SELF_STYLED_PANEL_CONTENT_CLASS,
  useDialogService
} from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { usePromptStore } from '@/stores/promptStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeId } = defineProps<{
  widget?: SimplifiedWidget<PromptTemplate>
  nodeId: string
}>()

const modelValue = defineModel<PromptTemplate>({ default: () => [] })

const { t } = useI18n()
const store = usePromptStore()
const canvasStore = useCanvasStore()

const search = ref('')
const promptSuggestions = computed<Prompt[]>(() => store.prompts)
const isEmpty = computed(() => (modelValue.value ?? []).length === 0)
const isReadOnly = computed(() =>
  Boolean(widget?.options?.read_only || widget?.options?.disabled)
)

function getNode(): LGraphNode | undefined {
  return canvasStore.canvas?.graph?.getNodeById(nodeId) ?? undefined
}

function openManager() {
  const key = 'prompt-manager'
  const dialogStore = useDialogStore()
  useDialogService().showLayoutDialog({
    key,
    component: PromptManagerDialogContent,
    props: { onClose: () => dialogStore.closeDialog({ key }) },
    dialogComponentProps: { contentClass: SELF_STYLED_PANEL_CONTENT_CLASS }
  })
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

function loadPrompt(prompt: Prompt) {
  void applySelectedPrompt(prompt)
}

async function applySelectedPrompt(prompt: Prompt) {
  search.value = ''
  let template = prompt.template
  if (!template.length) {
    try {
      template = await store.resolveTemplate(prompt.id)
    } catch (error) {
      console.error('[PromptNode] Failed to load prompt content', error)
      return
    }
  }
  modelValue.value = JSON.parse(JSON.stringify(template))
}

// --- Save as prompt -------------------------------------------------------
const showSave = ref(false)
const saveName = ref('')
const isSaving = ref(false)
const nameInputEl = ref<HTMLInputElement>()

const canSave = computed(
  () => saveName.value.trim().length > 0 && !isEmpty.value && !isSaving.value
)

function toggleSave() {
  showSave.value = !showSave.value
  if (showSave.value) void nextTick(() => nameInputEl.value?.focus())
}

async function confirmSave() {
  if (!canSave.value) return
  isSaving.value = true
  try {
    await store.savePrompt({
      name: saveName.value.trim(),
      template: modelValue.value ?? []
    })
    showSave.value = false
    saveName.value = ''
  } finally {
    isSaving.value = false
  }
}
</script>
