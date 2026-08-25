<template>
  <WidgetLayoutField v-slot="{ borderStyle }" :widget :no-border="!hasLabels">
    <ToggleGroup
      v-if="hasLabels"
      type="single"
      :model-value="modelValue ? 'on' : 'off'"
      :disabled="
        Boolean(
          widget.linkedDisplay ||
          widget.options?.read_only ||
          widget.options?.disabled
        )
      "
      :class="
        cn(
          WidgetInputBaseClass,
          'flex w-full min-w-0 items-center justify-center gap-1 p-1'
        )
      "
      @update:model-value="(v) => handleOptionChange(v as string)"
    >
      <ToggleGroupItem value="off" size="sm">
        {{ widget.options?.off ?? t('widgets.boolean.false') }}
      </ToggleGroupItem>
      <ToggleGroupItem value="on" size="sm">
        {{ widget.options?.on ?? t('widgets.boolean.true') }}
      </ToggleGroupItem>
    </ToggleGroup>

    <div
      v-else
      :class="
        cn(
          'relative -m-1 flex w-fit items-center gap-2 rounded-full p-1',
          hideLayoutField || 'ml-auto',
          borderStyle
        )
      "
    >
      <div
        :class="cn('contents', isLinkedSwitch && 'invisible')"
        :aria-hidden="isLinkedSwitch ? 'true' : undefined"
        :inert="isLinkedSwitch ? true : undefined"
        :data-testid="isLinkedSwitch ? 'linked-widget-content' : undefined"
      >
        <Switch
          v-model="modelValue"
          :disabled="isLinkedSwitch || Boolean(widget.options?.disabled)"
          :readonly="Boolean(widget.options?.read_only)"
          :aria-label="widget.name"
        />
      </div>
      <LinkedWidgetStatus v-if="isLinkedSwitch" display="switch" :widget />
    </div>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Switch from '@/components/ui/switch/Switch.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { useHideLayoutField } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import LinkedWidgetStatus from './LinkedWidgetStatus.vue'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

const { widget } = defineProps<{
  widget: SimplifiedWidget<boolean, IWidgetOptions>
}>()

const modelValue = defineModel<boolean>()

const hideLayoutField = useHideLayoutField()
const { t } = useI18n()

const hasLabels = computed(() => {
  return widget.options?.on != null || widget.options?.off != null
})
const isLinkedSwitch = computed(() => widget.linkedDisplay === 'switch')

function handleOptionChange(value: string | undefined) {
  if (value) {
    modelValue.value = value === 'on'
  }
}
</script>
