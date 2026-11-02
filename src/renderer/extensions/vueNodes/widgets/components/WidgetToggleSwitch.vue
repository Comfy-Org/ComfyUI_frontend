<template>
  <WidgetLayoutField
    v-slot="{ borderStyle }"
    :widget
    :input-id="inputId"
    :no-border="!hasLabels"
  >
    <ToggleGroup
      v-if="hasLabels"
      type="single"
      :model-value="modelValue ? 'on' : 'off'"
      :disabled="Boolean(widget.options?.read_only)"
      :class="
        cn(
          WidgetInputBaseClass,
          'flex w-full min-w-0 items-center justify-center gap-1 p-1'
        )
      "
      @update:model-value="(v) => handleOptionChange(v as string)"
    >
      <ToggleGroupItem
        :id="modelValue ? inputId : undefined"
        value="off"
        :aria-label="widget.options?.off ?? t('widgets.boolean.false')"
        size="sm"
        class="flex-1 truncate"
      >
        {{ widget.options?.off ?? t('widgets.boolean.false') }}
      </ToggleGroupItem>
      <ToggleGroupItem
        :id="modelValue ? undefined : inputId"
        value="on"
        :aria-label="widget.options?.on ?? t('widgets.boolean.true')"
        size="sm"
        class="flex-1 truncate"
      >
        {{ widget.options?.on ?? t('widgets.boolean.true') }}
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
        :model-value
        :disabled="Boolean(widget.options?.disabled)"
        :readonly="Boolean(widget.options?.read_only)"
        :aria-label="widget.label || widget.name"
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
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean, IWidgetOptions>
}>()

const modelValue = defineModel<boolean>()
const inputId = useId()

const hideLayoutField = useHideLayoutField()
const { t } = useI18n()

const hasLabels = computed(() => {
  return widget.options?.on != null || widget.options?.off != null
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
