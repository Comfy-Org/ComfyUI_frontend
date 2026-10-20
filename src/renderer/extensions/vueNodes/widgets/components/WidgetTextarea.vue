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
      :class="
        cn(
          'pointer-events-none absolute top-1 left-2 z-10 rounded-sm px-1 text-2xs text-muted-foreground',
          isReadOnly ? 'bg-input/50' : 'bg-input'
        )
      "
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
      role="group"
      :aria-label="$t('g.actions')"
      :class="
        cn(
          'pointer-events-none absolute top-0 right-0 z-10 flex gap-1 rounded-tr-md bg-linear-to-r from-transparent to-50% py-1.5 pr-1.5 pl-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          isReadOnly ? 'to-input/50' : 'to-input'
        )
      "
    >
      <Button
        v-if="isReadOnly"
        variant="tertiary"
        size="unset"
        :class="actionButtonClass"
        :title="$t('g.copyToClipboard')"
        :aria-label="$t('g.copyToClipboard')"
        @click="handleCopy"
        @pointerdown.capture.stop
      >
        <i class="icon-[lucide--copy] size-3" />
      </Button>
      <Button
        v-if="!widget.linkedUpstream"
        variant="tertiary"
        size="unset"
        :class="actionButtonClass"
        :title="$t('textEditor.expand')"
        :aria-label="$t('textEditor.expand')"
        @click="openTextEditor"
        @pointerdown.capture.stop
      >
        <i class="icon-[lucide--maximize-2] size-3" />
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
  'pointer-events-none size-6 border border-solid border-border shadow-md group-hover:pointer-events-auto'

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
