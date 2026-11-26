<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-5 pb-4">
    <p class="truncate text-sm text-muted-foreground">
      {{
        $t('textEditor.title', { widget: widgetLabel, node: target.node.title })
      }}
    </p>
    <Textarea
      ref="textareaRef"
      v-bind="textareaAttributes"
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
import { omit } from 'es-toolkit'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watch
} from 'vue'

import {
  getWidgetState,
  isWidgetAttached,
  isWidgetReadOnly,
  useSetWidgetValue
} from '@/composables/graph/widgetValue'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { PromptPanelTarget } from '@/renderer/extensions/textEditor/promptPanelStore'
import { usePromptPanelStore } from '@/renderer/extensions/textEditor/promptPanelStore'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

const { target } = defineProps<{ target: PromptPanelTarget }>()

const promptPanelStore = usePromptPanelStore()
const setWidgetValue = useSetWidgetValue()
const textareaRef = useTemplateRef('textareaRef')

const widgetState = computed(() => getWidgetState(target.node, target.widget))
const widgetLabel = computed(
  () => widgetState.value?.label || target.widget.label || target.widget.name
)
const isReadOnly = computed(() => isWidgetReadOnly(target.node, target.widget))
const textareaAttributes = computed(() =>
  omit(
    filterWidgetProps(
      widgetState.value?.options ?? target.widget.options,
      INPUT_EXCLUDED_PROPS
    ),
    ['disabled']
  )
)

let isEdited = false

const text = computed({
  get: () => String(widgetState.value?.value ?? target.widget.value ?? ''),
  set: (value: string) => {
    if (!isWidgetAttached(target.node, target.widget)) {
      promptPanelStore.close()
      return
    }
    isEdited = true
    setWidgetValue(target.node, target.widget, value)
    promptPanelStore.recordInput()
    useWorkflowStore().activeWorkflow?.changeTracker.markModified()
  }
})

function endEditSession() {
  promptPanelStore.isEditorFocused = false
  if (!isEdited) return
  isEdited = false
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  changeTracker?.captureCanvasState()
  changeTracker?.updateModified()
}

function takeRequestedFocus() {
  if (!promptPanelStore.autofocus) return
  promptPanelStore.autofocus = false
  if (isReadOnly.value) return
  const element: unknown = textareaRef.value?.$el
  if (!(element instanceof HTMLTextAreaElement)) return
  element.setSelectionRange(0, 0)
  element.focus()
}

onMounted(takeRequestedFocus)
watch(() => promptPanelStore.autofocus, takeRequestedFocus, { flush: 'post' })

onBeforeUnmount(endEditSession)
</script>
