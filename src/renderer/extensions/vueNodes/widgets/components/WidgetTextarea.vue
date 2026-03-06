<template>
  <div
    :class="
      cn(
        'group relative rounded-lg transition-all focus-within:ring focus-within:ring-component-node-widget-background-highlighted hover:bg-component-node-widget-background-hovered',
        widget.borderStyle
      )
    "
  >
    <label
      v-if="!hideLayoutField"
      :for="id"
      class="pointer-events-none absolute top-1.5 left-3 z-10 text-xxs text-muted-foreground"
    >
      {{ displayName }}
    </label>
    <Textarea
      v-bind="filteredProps"
      :id
      ref="textareaRef"
      v-model="modelValue"
      :class="
        cn(
          WidgetInputBaseClass,
          'size-full resize-none text-xs',
          !hideLayoutField && 'pt-5',
          isClipTextEncode &&
            'selection:text-transparent selection:bg-blue-500/50'
        )
      "
      :placeholder
      :readonly="isReadOnly"
      :style="isClipTextEncode ? '-webkit-text-fill-color: transparent;' : ''"
      data-capture-wheel="true"
      @scroll.passive="syncScroll"
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
          'pointer-events-none absolute inset-0',
          'text-xs font-[monospace] whitespace-pre-wrap wrap-break-word overflow-y-auto',
          'border border-transparent px-2.75 pb-5',
          '[scrollbar-color:transparent_transparent] [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent',
          !hideLayoutField ? 'pt-5' : 'pt-2'
        )
      "
      v-html="sanitizedHighlightedText"
    ></div>
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
import { computed, useId, ref, watch, nextTick } from 'vue'
import dompurify from 'dompurify'
import { useSettingStore } from '@/platform/settings/settingStore'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
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
const { copyToClipboard } = useCopyToClipboard()

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

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const textareaRef = ref<InstanceType<typeof Textarea> | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const highlightedText = useTextareaHighlighting(modelValue, isClipTextEncode)

const sanitizedHighlightedText = computed(() => {
  return dompurify.sanitize(highlightedText.value)
})

const syncScroll = (e?: Event) => {
  if (!overlayRef.value) return

  let target: HTMLElement
  if (e) {
    target = e.target as HTMLElement
  } else {
    target = textareaRef.value?.$el ?? textareaRef.value
  }

  if (target) {
    overlayRef.value.scrollTop = target.scrollTop
    overlayRef.value.scrollLeft = target.scrollLeft
  }
}

watch(
  isClipTextEncode,
  (newValue) => {
    if (newValue) {
      nextTick(() => syncScroll())
    }
  },
  { immediate: true }
)
function handleCopy() {
  copyToClipboard(modelValue.value)
}
</script>
