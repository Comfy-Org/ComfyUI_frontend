<template>
  <WidgetLayoutField
    data-testid="widget-text-row"
    :widget="layoutWidget"
    :input-id
    :value-text="modelValue"
    full-width-control
    :root-class="
      cn(!isReadOnly && 'hover:bg-muted', size === 'large' && 'py-3 text-sm')
    "
  >
    <Loader
      v-if="loading"
      size="sm"
      class="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-foreground"
    />
    <button
      v-if="pathProvider"
      :id="inputId"
      type="button"
      :aria-label="widget.name"
      :disabled="isReadOnly"
      class="absolute inset-0 h-full w-full truncate px-2 text-right text-xs"
      data-part="widget-text-input"
      :data-size="size"
      @pointerdown.stop
      @click.stop="openPathEditor"
    >
      {{ modelValue || $t('pathCompletion.title') }}
    </button>
    <Input
      v-else
      v-bind="filteredProps"
      :id="inputId"
      v-model="modelValue"
      :class="
        cn(
          WidgetInputBaseClass,
          'h-auto min-w-[4ch] truncate',
          size === 'large' ? 'py-3' : 'text-xs',
          'absolute inset-0 h-full px-2 text-right not-disabled:bg-transparent focus-visible:ring-0 aria-invalid:ring-0',
          loading && 'pl-9'
        )
      "
      :size="1"
      data-part="widget-text-input"
      :data-size="size"
      :aria-label="widget.name"
      :aria-invalid="invalid || undefined"
      :readonly="isReadOnly"
    />
    <PathCompletionDialog
      v-if="session && pathProvider && pathTarget"
      :provider="pathProvider"
      :widget="pathTarget"
      :initial-value="session.value"
      :label="widget.label || widget.name"
      :maxlength="
        'maxlength' in filteredProps &&
        typeof filteredProps.maxlength === 'number'
          ? filteredProps.maxlength
          : undefined
      "
      @close="session = undefined"
      @confirm="confirmPath"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, shallowRef, useId, watch } from 'vue'

import Loader from '@/components/loader/Loader.vue'
import Input from '@comfyorg/design-system/input/Input'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWidgetAugmentations } from '@/platform/extensions/useWidgetAugmentations'
import PathCompletionDialog from '@/renderer/extensions/PathCompletionDialog.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@comfyorg/tailwind-utils'
import {
  INPUT_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const {
  widget,
  size = 'medium',
  invalid = false,
  loading = false,
  nodeType
} = defineProps<{
  widget: SimplifiedWidget<string>
  size?: 'medium' | 'large'
  invalid?: boolean
  loading?: boolean
  nodeType?: string
}>()

const modelValue = defineModel<string>({ default: '' })
const inputId = useId()

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const { widget: pathTarget, contributions } = useWidgetAugmentations(() => {
  const type = widget.nodeType ?? nodeType
  return type ? { nodeType: type, widgetName: widget.name } : undefined
})
const pathProvider = computed(() => {
  const providers = contributions.value.flatMap(({ augmentation }) =>
    augmentation.kind === 'path-completion' ? [augmentation] : []
  )
  return providers.length === 1 ? providers[0] : undefined
})
const session = shallowRef<{ value: string }>()

watch(
  contributions,
  (items) => {
    if (
      items.filter(
        ({ augmentation }) => augmentation.kind === 'path-completion'
      ).length > 1
    ) {
      reportError(new Error('Conflicting path-completion providers'), {
        errorType: 'error_evaluating_widget_augmentation',
        surface: 'platform',
        context: {
          nodeType: widget.nodeType ?? nodeType,
          widgetName: widget.name
        }
      })
    }
  },
  { immediate: true }
)

function openPathEditor() {
  if (!isReadOnly.value) session.value = { value: modelValue.value }
}

function confirmPath(value: string) {
  if (
    session.value &&
    pathProvider.value &&
    !isReadOnly.value &&
    modelValue.value === session.value.value &&
    value !== modelValue.value
  ) {
    modelValue.value = value
  }
  session.value = undefined
}

watch(
  [pathProvider, isReadOnly, modelValue, () => widget],
  () => {
    session.value = undefined
  },
  { flush: 'sync' }
)

const layoutWidget = computed(() => ({
  name: widget.name,
  label: widget.label,
  borderStyle: cn(widget.borderStyle, invalid && 'border border-destructive')
}))
</script>
