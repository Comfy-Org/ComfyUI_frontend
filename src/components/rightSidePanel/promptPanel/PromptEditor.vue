<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-5 pb-4">
    <p class="truncate text-sm text-muted-foreground">
      {{ widgetLabel }} · {{ target.node.title }}
    </p>
    <Textarea
      ref="textareaRef"
      v-model="text"
      :aria-label="widgetLabel"
      :readonly="isReadOnly"
      class="min-h-40 flex-1 resize-none p-3.5 font-inter leading-5.5 focus-visible:ring-0"
      data-testid="prompt-panel-textarea"
      @focus="promptPanelStore.isEditorFocused = true"
      @blur="endEditSession"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watch
} from 'vue'

import {
  getWidgetState,
  isWidgetReadOnly,
  useSetWidgetValue
} from '@/components/rightSidePanel/parameters/widgetValue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { PromptPanelTarget } from '@/stores/workspace/promptPanelStore'
import { usePromptPanelStore } from '@/stores/workspace/promptPanelStore'

const { target } = defineProps<{ target: PromptPanelTarget }>()

const promptPanelStore = usePromptPanelStore()
const setWidgetValue = useSetWidgetValue()
const textareaRef = useTemplateRef('textareaRef')

const widgetState = computed(() => getWidgetState(target.node, target.widget))
const widgetLabel = computed(
  () => widgetState.value?.label || target.widget.label || target.widget.name
)
const isReadOnly = computed(() => isWidgetReadOnly(target.node, target.widget))

let isEdited = false

const text = computed({
  get: () => String(widgetState.value?.value ?? target.widget.value ?? ''),
  set: (value: string) => {
    isEdited = true
    setWidgetValue(target.node, target.widget, value)
    promptPanelStore.recordInput()
  }
})

function endEditSession() {
  promptPanelStore.isEditorFocused = false
  if (!isEdited) return
  isEdited = false
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}

function takeRequestedFocus() {
  if (!promptPanelStore.autofocus) return
  promptPanelStore.autofocus = false
  const element: unknown = textareaRef.value?.$el
  if (!(element instanceof HTMLTextAreaElement)) return
  element.setSelectionRange(0, 0)
  element.focus()
}

onMounted(takeRequestedFocus)
watch(() => promptPanelStore.autofocus, takeRequestedFocus, { flush: 'post' })

onBeforeUnmount(endEditSession)
</script>
