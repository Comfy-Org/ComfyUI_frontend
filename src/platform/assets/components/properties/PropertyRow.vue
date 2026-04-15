<template>
  <!-- String: two rows (label top, full-width input below) -->
  <ModelInfoField v-if="property.type === 'string'" :label="propertyKey">
    <template #label-action>
      <PropertyRowActions
        :readonly
        :count
        :total-count="totalCount"
        @delete="emit('delete')"
      />
    </template>
    <Textarea
      class="min-h-10 resize-y"
      rows="1"
      :model-value="isMixed ? '' : property.value"
      :placeholder="isMixed ? t('properties.mixed') : ''"
      :disabled="readonly"
      @update:model-value="updateStringValue"
    />
  </ModelInfoField>

  <!-- Boolean / Number: single row (label left, control right) -->
  <div
    v-else
    class="group flex items-center justify-between gap-2 px-4 py-2 text-sm text-base-foreground"
  >
    <div class="flex items-center gap-1 select-none">
      <span>{{ propertyKey }}</span>
      <span
        v-if="
          count !== undefined && totalCount !== undefined && count < totalCount
        "
        class="text-2xs text-muted-foreground"
      >
        {{ count }}/{{ totalCount }}
      </span>
    </div>

    <div class="flex items-center gap-1">
      <!-- Boolean -->
      <ToggleGroup
        v-if="property.type === 'boolean'"
        type="single"
        :model-value="isMixed ? undefined : property.value ? 'on' : 'off'"
        :disabled="readonly"
        class="rounded-lg border border-border-default p-1"
        @update:model-value="
          (v) => {
            if (v) updateBooleanValue(v === 'on')
          }
        "
      >
        <ToggleGroupItem value="off" size="sm">
          {{ t('widgets.boolean.false') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="on" size="sm">
          {{ t('widgets.boolean.true') }}
        </ToggleGroupItem>
      </ToggleGroup>

      <!-- Number -->
      <FormattedNumberStepper
        v-else-if="property.type === 'number'"
        :model-value="isMixed ? (property.min ?? 0) : property.value"
        :min="property.min"
        :max="property.max"
        :disabled="readonly"
        @update:model-value="updateNumberValue"
      />

      <Button
        v-if="!readonly"
        size="icon-sm"
        variant="muted-textonly"
        class="opacity-0 transition-opacity group-hover:opacity-100"
        :aria-label="t('g.delete')"
        @click="emit('delete')"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import ModelInfoField from '@/platform/assets/components/modelInfo/ModelInfoField.vue'
import type { UserProperty } from '@/platform/assets/schemas/userPropertySchema'

import PropertyRowActions from './PropertyRowActions.vue'

const { t } = useI18n()

const {
  propertyKey,
  property,
  readonly = false,
  isMixed = false,
  count,
  totalCount
} = defineProps<{
  propertyKey: string
  property: UserProperty
  readonly?: boolean
  isMixed?: boolean
  count?: number
  totalCount?: number
}>()

const emit = defineEmits<{
  'update:property': [property: UserProperty]
  delete: []
}>()

function updateStringValue(value: string | number | undefined) {
  emit('update:property', { type: 'string', value: String(value ?? '') })
}

function updateBooleanValue(value: boolean) {
  emit('update:property', { type: 'boolean', value })
}

function updateNumberValue(value: number) {
  if (property.type !== 'number') return
  emit('update:property', {
    type: 'number',
    value,
    ...(property.min !== undefined && { min: property.min }),
    ...(property.max !== undefined && { max: property.max })
  })
}
</script>
