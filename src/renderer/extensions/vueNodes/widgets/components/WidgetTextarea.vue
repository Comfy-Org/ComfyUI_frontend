<template>
  <div
    :class="
      cn(
        'group relative rounded-lg transition-all focus-within:ring focus-within:ring-component-node-widget-background-highlighted',
        !isReadOnly && 'hover:bg-component-node-widget-background-hovered',
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
          'size-full resize-none text-(length:--comfy-textarea-font-size) leading-normal',
          !hideLayoutField && 'pt-5',
          // Avoid overflow-auto when idle to prevent per-textarea compositing layers.
          'overflow-hidden hover:overflow-auto focus:overflow-auto'
        )
      "
      :placeholder
      :readonly="isReadOnly"
      data-capture-wheel="true"
      @pointerdown.capture.stop="trackFocus"
      @pointermove.capture.stop
      @pointerup.capture.stop="handleSelection"
      @input="handleInput"
      @keydown="handleKeyDown"
      @wheel="handleWheel"
      @contextmenu.capture="handleContextMenu"
    />
    <Button
      v-if="isReadOnly"
      variant="textonly"
      size="icon"
      class="invisible absolute top-1.5 right-1.5 z-10 group-focus-within:visible group-hover:visible hover:bg-base-foreground/10"
      :title="$t('g.copyToClipboard')"
      :aria-label="$t('g.copyToClipboard')"
      @click="handleCopy"
      @pointerdown.capture.stop
    >
      <i class="icon-[lucide--copy] size-4 text-component-node-foreground" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { dispatchWidgetTextInteraction } from '@/platform/nodeApi/widgetTextInteraction'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'

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
const canvasStore = useCanvasStore()

function textArea(): HTMLTextAreaElement | undefined {
  const element = textAreaRef.value?.$el
  return element instanceof HTMLTextAreaElement ? element : undefined
}

function hostWidget() {
  if (nodeId === undefined) return
  const node = canvasStore.canvas?.graph?.getNodeById(nodeId) ?? undefined
  return resolveWidgetFromHostNode(node, widget.name)?.widget
}

function dispatch(
  kind: 'input' | 'selection' | 'wheel' | 'keydown',
  event: Event
): void {
  const element = textArea()
  const source = hostWidget()
  if (!element || !source) return
  if (kind === 'wheel' && event instanceof WheelEvent) {
    dispatchWidgetTextInteraction(source, element, kind, event)
    return
  }
  if (kind === 'keydown' && event instanceof KeyboardEvent) {
    dispatchWidgetTextInteraction(source, element, kind, event)
    return
  }
  if (kind === 'input' || kind === 'selection') {
    dispatchWidgetTextInteraction(source, element, kind, event)
  }
}

function handleInput(event: Event) {
  dispatch('input', event)
}

function handleSelection(event: PointerEvent) {
  dispatch('selection', event)
}

function handleKeyDown(event: KeyboardEvent) {
  dispatch('keydown', event)
}

function handleWheel(event: WheelEvent) {
  dispatch('wheel', event)
}

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
</script>
