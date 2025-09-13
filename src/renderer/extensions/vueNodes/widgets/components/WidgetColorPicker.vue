<!-- Needs custom color picker for alpha support -->
<template>
  <WidgetLayoutField :widget="widget">
    <label
      :class="
        cn(WidgetInputBaseClass, 'flex items-center gap-2 w-full px-4 py-2')
      "
    >
      <ColorPicker
        v-model="localValue"
        v-bind="filteredProps"
        :disabled="readonly"
        class="w-8 h-4 !rounded-full overflow-hidden border-none"
        :pt="{
          preview: '!w-full !h-full !border-none'
        }"
        @update:model-value="onChange"
      />
      <span class="text-xs" data-testid="widget-color-text">{{
        localValue.startsWith('#') ? localValue : '#' + localValue
      }}</span>
    </label>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import { computed } from 'vue'

import { useWidgetValue } from '@/composables/graph/useWidgetValue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { hsbToRgb, parseToRgb, rgbToHex } from '@/utils/colorUtil'
import { cn } from '@/utils/tailwindUtil'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const props = defineProps<{
  widget: SimplifiedWidget<string>
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Use the composable for consistent widget value handling
function normalizeToHexWithHash(value: unknown): string {
  if (typeof value === 'string') {
    const raw = value.trim()
    // Bare hex without '#'
    if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
      return `#${raw.toLowerCase()}`
    }
    // If starts with '#', ensure lower-case and valid length
    if (raw.startsWith('#')) {
      const hex = raw.toLowerCase()
      if (hex.length === 4 || hex.length === 7) return hex
      // Fallback: attempt parse via RGB and re-encode
    }
    // rgb(), rgba(), hsl(), hsla()
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(raw)) {
      const rgb = parseToRgb(raw)
      return rgbToHex(rgb).toLowerCase()
    }
    // hsb(h,s,b)
    if (/^hsb\(/i.test(raw)) {
      const nums = raw.match(/\d+(?:\.\d+)?/g)?.map(Number) || []
      if (nums.length >= 3) {
        const rgb = hsbToRgb({ h: nums[0], s: nums[1], b: nums[2] })
        return rgbToHex(rgb).toLowerCase()
      }
    }
  }
  // HSB object from PrimeVue
  if (
    value &&
    typeof value === 'object' &&
    'h' in (value as any) &&
    's' in (value as any) &&
    ('b' in (value as any) || 'v' in (value as any))
  ) {
    const h = Number((value as any).h)
    const s = Number((value as any).s)
    const b = Number((value as any).b ?? (value as any).v)
    const rgb = hsbToRgb({ h, s, b })
    return rgbToHex(rgb).toLowerCase()
  }
  // Fallback to default black
  return '#000000'
}

const { localValue, onChange } = useWidgetValue({
  widget: props.widget,
  // Normalize initial model value to ensure leading '#'
  modelValue: normalizeToHexWithHash(props.modelValue),
  defaultValue: '#000000',
  emit,
  transform: (val: unknown) => normalizeToHexWithHash(val)
})

// ColorPicker specific excluded props include panel/overlay classes
const COLOR_PICKER_EXCLUDED_PROPS = [...PANEL_EXCLUDED_PROPS] as const

const filteredProps = computed(() =>
  filterWidgetProps(props.widget.options, COLOR_PICKER_EXCLUDED_PROPS)
)
</script>
