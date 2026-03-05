<template>
  <div
    :class="
      cn(
        'relative rounded-lg focus-within:ring focus-within:ring-component-node-widget-background-highlighted transition-all',
        widget.borderStyle
      )
    "
  >
    <label
      v-if="!hideLayoutField"
      :for="id"
      class="pointer-events-none absolute left-3 top-1.5 z-10 text-xxs text-muted-foreground"
    >
      {{ displayName }}
    </label>
    <Textarea
      v-bind="filteredProps"
      :id
      v-model="modelValue"
      :class="
        cn(
          WidgetInputBaseClass,
          'size-full text-xs resize-none',
          !hideLayoutField && 'pt-5'
        )
      "
      :placeholder
      :readonly="isReadOnly"
      :style="isClipTextEncode ? '-webkit-text-fill-color: transparent;' : ''"
      data-capture-wheel="true"
      @scroll="syncScroll"
      @pointerdown.capture.stop
      @pointermove.capture.stop
      @pointerup.capture.stop
      @contextmenu.capture.stop
    />
    <div
      v-if="isClipTextEncode"
      ref="overlayRef"
      aria-hidden="true"
      :class="
        cn(
          'absolute inset-0 z-11 pointer-events-none',
          'text-xs whitespace-pre-wrap wrap-break-word font-[monospace]',
          'border border-transparent px-2.75 pb-5',
          !hideLayoutField ? 'pt-5' : 'pt-2',
          'overflow-y-auto',
          '[scrollbar-color:transparent_transparent] [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent'
        )
      "
      v-html="highlightedText"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId, ref } from 'vue'
import { useSettingStore } from '@/platform/settings/settingStore'

import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import { useTextareaHighlighting } from '../composables/useTextareaHighlighting'

const {
  widget,
  placeholder = '',
  nodeType = ''
} = defineProps<{
  widget: SimplifiedWidget<string>
  placeholder?: string
  nodeType?: string
}>()

const modelValue = defineModel<string>({ default: '' })

const hideLayoutField = useHideLayoutField()

const settingStore = useSettingStore()

const isClipTextEncode = computed(() => {
  const isEnabled = settingStore.get(
    'Comfy.TextareaWidget.HighlightClipComments'
  )
  return isEnabled && nodeType.includes('CLIPTextEncode')
})

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const id = useId()

const isReadOnly = computed(
  () => widget.options?.read_only ?? widget.options?.disabled ?? false
)

const overlayRef = ref<HTMLElement | null>(null)
const highlightedText = useTextareaHighlighting(modelValue, isClipTextEncode)

const syncScroll = (e: Event) => {
  if (overlayRef.value) {
    const target = e.target as HTMLElement
    overlayRef.value.scrollTop = target.scrollTop
    overlayRef.value.scrollLeft = target.scrollLeft
  }
}
</script>
