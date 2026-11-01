<template>
  <WidgetLayoutField :widget="layoutWidget" :value-text="modelValue">
    <div class="relative">
      <Loader
        v-if="loading"
        size="sm"
        class="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-foreground"
      />
      <Input
        v-model="modelValue"
        v-bind="filteredProps"
        :class="
          cn(
            WidgetInputBaseClass,
            'h-auto min-w-[4ch] truncate',
            !isReadOnly && 'hover:bg-muted',
            size === 'large' ? 'py-3 text-sm' : 'py-2 text-xs',
            unifiedRows && 'pr-7 pl-2',
            loading && 'pl-9'
          )
        "
        :size="unifiedRows ? 1 : undefined"
        :aria-label="widget.name"
        :aria-invalid="invalid || undefined"
        :readonly="isReadOnly"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import Loader from '@/components/loader/Loader.vue'
import Input from '@comfyorg/design-system/input/Input'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'
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
  loading = false
} = defineProps<{
  widget: SimplifiedWidget<string>
  size?: 'medium' | 'large'
  invalid?: boolean
  loading?: boolean
}>()

const modelValue = defineModel<string>({ default: '' })
const unifiedRows = inject(UnifiedWidgetRowsKey, false)

const filteredProps = computed(() =>
  filterWidgetProps(widget.options, INPUT_EXCLUDED_PROPS)
)

const isReadOnly = computed(() =>
  Boolean(widget.options?.read_only || widget.options?.disabled)
)

const layoutWidget = computed(() => ({
  name: widget.name,
  label: widget.label,
  borderStyle: cn(widget.borderStyle, invalid && 'border border-destructive')
}))
</script>
