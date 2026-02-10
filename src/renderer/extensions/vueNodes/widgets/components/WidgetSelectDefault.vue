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
        label: cn('truncate min-w-[4ch]', $slots.default && 'mr-5'),
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
    <div class="absolute top-5 right-8 h-4 w-7 -translate-y-4/5 flex">
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

const props = defineProps<Props>()

function resolveValues(values: unknown): string[] {
  if (typeof values === 'function') return values()
  if (Array.isArray(values)) return values
  return []
}

const modelValue = defineModel<string | undefined>({
  default(props: Props) {
    const values: unknown = props.widget.options?.values
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved) ? (resolved[0] ?? '') : ''
  }
})

// Transform compatibility props for overlay positioning
const transformCompatProps = useTransformCompatOverlayProps()

const selectOptions = ref(resolveValues(props.widget.options?.values))
function refreshOptions() {
  selectOptions.value = resolveValues(props.widget.options?.values)
}
const invalid = computed(
  () => !!modelValue.value && !selectOptions.value.includes(modelValue.value)
)

const combinedProps = computed(() => ({
  ...filterWidgetProps(props.widget.options, PANEL_EXCLUDED_PROPS),
  ...transformCompatProps.value,
  ...(invalid.value ? { placeholder: `${modelValue.value}` } : {})
}))
</script>
