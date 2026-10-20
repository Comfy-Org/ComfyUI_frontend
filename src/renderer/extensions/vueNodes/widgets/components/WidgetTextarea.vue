<template>
  <div
    :class="
      cn(
        'group relative rounded-lg transition-all focus-within:ring focus-within:ring-ring',
        !isReadOnly && 'hover:bg-muted',
        widget.borderStyle
      )
    "
  >
    <label
      v-if="!hideLayoutField"
      :for="id"
      class="pointer-events-none absolute top-1.5 left-3 z-10 text-2xs text-muted-foreground"
    >
      {{ displayName }}
    </label>
    <Textarea
      v-bind="filteredProps"
      :id
      ref="textAreaRef"
      v-model="modelValue"
      :class="
        cn(
          WidgetInputBaseClass,
          'size-full resize-none font-mono text-(length:--comfy-textarea-font-size) leading-normal',
          !hideLayoutField && 'pt-5',
          'overflow-hidden hover:overflow-auto focus:overflow-auto'
        )
      "
      :placeholder
      :readonly="isReadOnly"
      data-capture-wheel="true"
      @pointerdown.capture.stop="trackFocus"
      @pointermove.capture.stop
      @pointerup.capture.stop
      @contextmenu.capture="handleContextMenu"
    />
    <div
      class="pointer-events-none absolute top-1.5 right-1.5 z-10 flex gap-0.5"
    >
      <Button
        v-if="isReadOnly"
        variant="textonly"
        size="icon"
        :class="actionButtonClass"
        :title="$t('g.copyToClipboard')"
        :aria-label="$t('g.copyToClipboard')"
        @click="handleCopy"
        @pointerdown.capture.stop
      >
        <i class="icon-[lucide--copy] size-4 text-foreground" />
      </Button>
      <Button
        v-if="!widget.linkedUpstream"
        variant="textonly"
        size="icon"
        :class="actionButtonClass"
        :title="$t('textEditor.expand')"
        :aria-label="$t('textEditor.expand')"
        @click="openTextEditor"
        @pointerdown.capture.stop
      >
        <i class="icon-[lucide--maximize-2] size-4 text-foreground" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { showTextEditor } from '@/renderer/extensions/textEditor/textEditorDialog'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import { resolveNode } from '@/utils/litegraphUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'

const actionButtonClass =
  'pointer-events-auto invisible group-focus-within:visible group-hover:visible hover:bg-foreground/10'

const {
  widget,
  nodeId,
  placeholder = ''
} = defineProps<{
  widget: SimplifiedWidget<string>
  nodeId?: NodeId
  placeholder?: string
}>()

const textAreaRef = useTemplateRef('textAreaRef')

const modelValue = defineModel<string>({ default: '' })

const isFocused = ref(false)
function trackFocus() {
  isFocused.value = document.activeElement === textAreaRef.value?.$el
}

const hideLayoutField = useHideLayoutField()
const { copyToClipboard } = useCopyToClipboard()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const id = useId()

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

function handleContextMenu(e: MouseEvent) {
  if (isNodeOptionsOpen() || isFocused.value) {
    e.stopPropagation()
    return
  }
  e.preventDefault()
}

function handleCopy() {
  copyToClipboard(modelValue.value)
}

const canvasStore = useCanvasStore()
let closeTextEditor: (() => void) | undefined

function openTextEditor() {
  const node =
    nodeId === undefined
      ? undefined
      : resolveNode(nodeId, canvasStore.currentGraph ?? undefined)
  closeTextEditor = showTextEditor({
    text: modelValue.value,
    widgetLabel: displayName.value,
    nodeTitle: node?.title,
    readOnly: isReadOnly.value,
    onEdit: (text) => (modelValue.value = text)
  })
}

onBeforeUnmount(() => closeTextEditor?.())
</script>
