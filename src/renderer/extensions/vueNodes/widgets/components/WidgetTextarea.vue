<template>
  <div
    :class="
      cn(
        'group relative rounded-lg focus-within:ring focus-within:ring-component-node-widget-background-highlighted transition-all',
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
      data-capture-wheel="true"
      @pointerdown.capture.stop
      @pointermove.capture.stop
      @pointerup.capture.stop
      @contextmenu.capture.stop
    />
    <Button
      v-if="isReadOnly"
      variant="textonly"
      size="icon"
      class="invisible absolute top-1.5 right-1.5 z-10 hover:bg-base-foreground/10 group-hover:visible"
      :title="$t('g.copyToClipboard')"
      :aria-label="$t('g.copyToClipboard')"
      @click="handleCopy"
      @pointerdown.capture.stop
    >
      <i class="icon-[lucide--copy] size-4" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

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

const { widget, placeholder = '' } = defineProps<{
  widget: SimplifiedWidget<string>
  placeholder?: string
}>()

const modelValue = defineModel<string>({ default: '' })

const hideLayoutField = useHideLayoutField()
const { copyToClipboard } = useCopyToClipboard()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const displayName = computed(() => widget.label || widget.name)
const id = useId()

const isReadOnly = computed(
  () => widget.options?.read_only ?? widget.options?.disabled ?? false
)

function handleCopy() {
  copyToClipboard(modelValue.value)
}
</script>
