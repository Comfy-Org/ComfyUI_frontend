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
    <Button
      v-if="isReadOnly"
      variant="textonly"
      size="icon"
      class="invisible absolute top-1.5 right-1.5 z-10 group-focus-within:visible group-hover:visible hover:bg-foreground/10"
      :title="$t('g.copyToClipboard')"
      :aria-label="$t('g.copyToClipboard')"
      @click="handleCopy"
      @pointerdown.capture.stop
    >
      <i class="icon-[lucide--copy] text-foreground" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'

const { widget, placeholder = '' } = defineProps<{
  widget: SimplifiedWidget<string>
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
</script>
