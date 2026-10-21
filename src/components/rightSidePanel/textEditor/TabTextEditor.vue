<template>
  <div class="flex size-full flex-col text-[15px]">
    <div
      class="flex h-10 shrink-0 items-center gap-2 border-t border-border/50 pr-3 pl-[max(--spacing(6),calc((100%-34em)/2))]"
    >
      <span class="min-w-0 truncate text-[13px] text-muted-foreground">
        <span class="font-medium text-foreground/80">{{ widgetLabel }}</span>
        · {{ target.node.title }}
      </span>
      <Button
        v-if="!isNodeSelected"
        variant="secondary"
        size="sm"
        class="ml-auto shrink-0"
        @click="showNode"
      >
        <i class="icon-[lucide--square-arrow-out-up-right] size-3" />
        {{ $t('textEditor.showNode') }}
      </Button>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :class="cn('shrink-0', isNodeSelected && 'ml-auto')"
        :title="$t('textEditor.close')"
        :aria-label="$t('textEditor.close')"
        @click="rightSidePanelStore.closeTextEditor()"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>
    <Textarea
      ref="textareaRef"
      v-model="text"
      :aria-label="widgetLabel"
      :readonly="isReadOnly"
      class="min-h-40 flex-1 resize-none rounded-none border-t border-solid border-border/50 bg-transparent px-[max(--spacing(6),calc((100%-34em)/2))] pt-8 pb-10 font-inter text-[15px] leading-6 focus-visible:ring-0"
      data-testid="text-editor-panel-textarea"
      @focus="rightSidePanelStore.isTextEditorFocused = true"
      @blur="endEditSession"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import {
  getWidgetState,
  useSetWidgetValue
} from '@/components/rightSidePanel/parameters/widgetValue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { TextEditorTarget } from '@/stores/workspace/rightSidePanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { cn } from '@comfyorg/tailwind-utils'

const { target } = defineProps<{ target: TextEditorTarget }>()

const rightSidePanelStore = useRightSidePanelStore()
const canvasStore = useCanvasStore()
const setWidgetValue = useSetWidgetValue()
const { focusNodeInstance } = useFocusNode()
const textareaRef = useTemplateRef('textareaRef')

const widgetState = computed(() => getWidgetState(target.node, target.widget))
const widgetLabel = computed(
  () => widgetState.value?.label || target.widget.label || target.widget.name
)
const isReadOnly = computed(() => {
  const options = widgetState.value?.options ?? target.widget.options
  return Boolean(options?.read_only || options?.disabled)
})
const isNodeSelected = computed(() =>
  canvasStore.selectedItems.includes(target.node)
)

let isEdited = false

const text = computed({
  get: () => String(widgetState.value?.value ?? target.widget.value ?? ''),
  set: (value: string) => {
    isEdited = true
    setWidgetValue(target.node, target.widget, value)
  }
})

function endEditSession() {
  rightSidePanelStore.isTextEditorFocused = false
  if (!isEdited) return
  isEdited = false
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}

async function showNode() {
  await focusNodeInstance(target.node)
  canvasStore.canvas?.selectItems([target.node])
}

onMounted(() => {
  const element: unknown = textareaRef.value?.$el
  if (!(element instanceof HTMLTextAreaElement)) return
  element.setSelectionRange(0, 0)
  element.focus()
})

onBeforeUnmount(endEditSession)
</script>
