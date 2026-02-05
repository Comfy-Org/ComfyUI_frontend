<template>
  <WidgetLayoutField :widget>
    <SelectPlus
      v-model="modelValue"
      :invalid
      :filter="selectOptions.length > 4"
      auto-filter-focus
      :options="selectOptions"
      v-bind="combinedProps"
      :class="cn(WidgetInputBaseClass, 'w-full text-xs')"
      :aria-label="widget.name"
      size="small"
      :pt="{
        option: 'text-xs',
        dropdown: 'w-8',
        label: cn('min-w-[4ch] truncate', $slots.default && 'mr-5'),
        overlay: 'w-fit min-w-full'
      }"
      data-capture-wheel="true"
      @show="refreshOptions"
      @filter="refreshOptions"
    >
      <template #dropdownicon>
        <i
          class="icon-[lucide--chevron-down] size-4 text-component-node-foreground-secondary"
        />
      </template>
    </SelectPlus>
    <div class="absolute top-5 right-8 flex h-4 w-7 -translate-y-4/5">
      <slot />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import SelectPlus from '@/components/primevueOverride/SelectPlus.vue'
import { useTransformCompatOverlayProps } from '@/composables/useTransformCompatOverlayProps'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'
import {
  PANEL_EXCLUDED_PROPS,
  filterWidgetProps
} from '@/utils/widgetPropFilter'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

interface Props {
  widget: SimplifiedWidget<string | undefined>
}

const { widget } = defineProps<Props>()

function resolveValues(values: unknown): string[] {
  if (typeof values === 'function') return values()
  if (Array.isArray(values)) return values
  return []
}

const modelValue = defineModel<string | undefined>({
  default(props: Props) {
    const values = props.widget.options?.values
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved) ? (resolved[0] ?? '') : ''
  }
})

// Transform compatibility props for overlay positioning
const transformCompatProps = useTransformCompatOverlayProps()

const refreshTrigger = ref(0)
function refreshOptions() {
  refreshTrigger.value++
}
const selectOptions = computed(() => {
  void refreshTrigger.value
  return resolveValues(widget.options?.values)
})
const invalid = computed(
  () => !!modelValue.value && !selectOptions.value.includes(modelValue.value)
)

const hasEmptyOptions = computed(() => selectOptions.value.length === 0)

const combinedProps = computed(() => {
  // Extract placeholder to handle it separately based on empty/invalid state
  const { placeholder: _, ...filteredOptions } = filterWidgetProps(
    widget.options,
    PANEL_EXCLUDED_PROPS
  )
  const baseProps = {
    ...filteredOptions,
    ...transformCompatProps.value
  }

  if (hasEmptyOptions.value && widget.options?.placeholder) {
    return { ...baseProps, placeholder: widget.options.placeholder }
  }

  if (invalid.value) {
    return { ...baseProps, placeholder: `${modelValue.value}` }
  }

  return baseProps
})
</script>
