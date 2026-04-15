<template>
  <!-- String: two rows (label top, full-width input below) -->
  <ModelInfoField v-if="property.type === 'string'" :class="rowClass">
    <template #label>
      {{ propertyKey }}
      <span
        v-if="count !== undefined && totalCount !== undefined"
        class="text-2xs text-muted-foreground"
      >
        {{ count }}/{{ totalCount }}
      </span>
    </template>
    <template #label-action>
      <PropertyRowActions :readonly @delete="emit('delete')" />
    </template>
    <Textarea
      class="min-h-10 resize-y border border-border-default"
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
    :class="
      cn(
        'group flex items-center justify-between gap-2 px-4 py-2 text-sm text-base-foreground',
        rowClass
      )
    "
  >
    <div class="flex items-center gap-1 select-none">
      <span>{{ propertyKey }}</span>
      <span
        v-if="count !== undefined && totalCount !== undefined"
        class="text-2xs text-muted-foreground"
      >
        {{ count }}/{{ totalCount }}
      </span>
    </div>

    <div class="flex items-center gap-1">
      <!-- Boolean -->
      <CheckboxRoot
        v-if="property.type === 'boolean'"
        :checked="isMixed ? 'indeterminate' : property.value"
        :disabled="readonly"
        class="flex size-5 shrink-0 items-center justify-center rounded-sm border border-border-default bg-secondary-background transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
        @update:checked="(v: boolean | 'indeterminate') => updateBooleanValue(v === true)"
      >
        <CheckboxIndicator class="text-primary-foreground">
          <i
            v-if="isMixed"
            class="icon-[lucide--minus] size-3.5"
          />
          <i v-else class="icon-[lucide--check] size-3.5" />
        </CheckboxIndicator>
      </CheckboxRoot>

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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

import Button from '@/components/ui/button/Button.vue'
import FormattedNumberStepper from '@/components/ui/stepper/FormattedNumberStepper.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import ModelInfoField from '@/platform/assets/components/modelInfo/ModelInfoField.vue'
import type { UserProperty } from '@/platform/assets/schemas/userPropertySchema'
import { coverageOpacityClass } from '@/platform/assets/schemas/userPropertySchema'
import { cn } from '@/utils/tailwindUtil'

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

const rowClass = computed(() => {
  if (count === undefined || totalCount === undefined) return undefined
  return coverageOpacityClass(count, totalCount)
})

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
