<template>
  <WidgetLayoutField
    v-slot="{ borderStyle }"
    :widget-id
    :display-label
    :input-id
    :no-border="!hasLabels"
    :root-class="
      cn(hasLabels && 'h-auto triangle-icons:h-(--node-widget-height)')
    "
  >
    <ToggleGroup
      v-if="hasLabels"
      type="single"
      :model-value="modelValue ? 'on' : 'off'"
      :disabled="Boolean(options.read_only)"
      :class="
        cn(
          WidgetInputBaseClass,
          'w-full min-w-0 p-1 triangle-icons:h-full triangle-icons:p-0'
        )
      "
      @update:model-value="(v) => handleOptionChange(v as string)"
    >
      <ToggleGroupItem
        :id="modelValue ? inputId : undefined"
        value="off"
        :aria-label="options.off ?? t('widgets.boolean.false')"
        size="sm"
        class="flex-1 truncate triangle-icons:h-full"
      >
        {{ options.off ?? t('widgets.boolean.false') }}
      </ToggleGroupItem>
      <ToggleGroupItem
        :id="modelValue ? undefined : inputId"
        value="on"
        :aria-label="options.on ?? t('widgets.boolean.true')"
        size="sm"
        class="flex-1 truncate triangle-icons:h-full"
      >
        {{ options.on ?? t('widgets.boolean.true') }}
      </ToggleGroupItem>
    </ToggleGroup>

    <div
      v-else
      :class="
        cn(
          '-m-1 flex w-fit items-center gap-2 rounded-full p-1',
          hideLayoutField || 'ml-auto',
          borderStyle
        )
      "
    >
      <Switch
        :id="inputId"
        class="triangle-icons:h-[calc(var(--node-widget-height)-2*var(--node-widget-border-width))] triangle-icons:w-9 triangle-icons:*:h-full triangle-icons:*:px-0 triangle-icons:**:data-[state=checked]:translate-x-4.5"
        :model-value
        :disabled="Boolean(options.disabled)"
        :readonly="Boolean(options.read_only)"
        :aria-label="widgetLabel(widgetId) || widgetName(widgetId)"
        @update:model-value="updateValue"
      />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Switch from '@comfyorg/design-system/switch/Switch'
import ToggleGroup from '@comfyorg/design-system/toggle-group/ToggleGroup'
import ToggleGroupItem from '@comfyorg/design-system/toggle-group/ToggleGroupItem'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  widgetLabel,
  widgetName,
  widgetOptions
} from '@/renderer/extensions/vueNodes/widgets/widgetEntity'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widgetId, displayLabel } = defineProps<{
  widgetId: WidgetId
  displayLabel?: string
}>()

const options = computed(() => widgetOptions(widgetId))

const modelValue = defineModel<boolean>()
const inputId = useId()

const hideLayoutField = useHideLayoutField()
const { t } = useI18n()

const hasLabels = computed(() => {
  return options.value.on != null || options.value.off != null
})

function handleOptionChange(value: string | undefined) {
  if (value) {
    updateValue(value === 'on')
  }
}

function updateValue(value: boolean) {
  modelValue.value = value
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}
</script>
