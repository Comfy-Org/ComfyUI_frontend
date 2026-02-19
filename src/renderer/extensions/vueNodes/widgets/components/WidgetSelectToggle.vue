<template>
  <WidgetLayoutField :widget>
    <div
      v-bind="filteredProps"
      :class="cn(WidgetInputBaseClass, 'flex gap-0.5 p-0.5 w-full')"
      role="group"
      :aria-label="widget.name"
    >
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        :class="
          cn(
            'flex-1 px-2 py-1 text-xs font-medium rounded transition-all duration-150',
            'bg-transparent border-none',
            'focus:outline-none',
            modelValue === option.value
              ? 'bg-interface-menu-component-surface-selected text-base-foreground'
              : 'text-muted-foreground hover:bg-interface-menu-component-surface-hovered'
          )
        "
        :aria-pressed="modelValue === option.value"
        @click="handleSelect(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { t } from '@/i18n'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  STANDARD_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string | number | boolean>
}>()

const modelValue = defineModel<string | number | boolean>({ required: true })

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)

interface ToggleOption {
  label: string
  value: string | number | boolean
}

const options = computed<ToggleOption[]>(() => {
  // Get options from widget spec or widget options
  const widgetOptions = props.widget.options?.values || props.widget.spec?.[0]

  if (Array.isArray(widgetOptions)) {
    // If options are strings/numbers, convert to {label, value} format
    return widgetOptions.map((opt) => {
      if (
        typeof opt === 'object' &&
        opt !== null &&
        'label' in opt &&
        'value' in opt
      ) {
        return opt as ToggleOption
      }
      return { label: String(opt), value: opt }
    })
  }

  // Default options for boolean widgets
  if (typeof modelValue.value === 'boolean') {
    return [
      { label: t('g.on', 'On'), value: true },
      { label: t('g.off', 'Off'), value: false }
    ]
  }

  // Fallback default options
  return [
    { label: t('g.yes', 'Yes'), value: true },
    { label: t('g.no', 'No'), value: false }
  ]
})

function handleSelect(value: string | number | boolean) {
  modelValue.value = value
}
</script>
