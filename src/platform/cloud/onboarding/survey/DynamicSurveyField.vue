<template>
  <fieldset
    v-if="field.type !== 'text'"
    :aria-invalid="Boolean(errorMessage)"
    class="flex flex-col gap-3 border-0 p-0"
  >
    <legend class="block text-lg font-medium text-base-foreground">
      {{ resolvedLabel }}
    </legend>
    <ToggleGroup
      v-if="field.type === 'single'"
      :model-value="(modelValue as string) ?? ''"
      type="single"
      class="flex flex-col gap-2"
      @update:model-value="onSingleChange"
    >
      <ToggleGroupItem
        v-for="option in field.options"
        :key="option.value"
        :value="option.value"
        class="h-auto justify-start rounded-md px-4 py-3 text-left whitespace-normal"
      >
        {{ option.label }}
      </ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup
      v-else
      :model-value="(modelValue as string[]) ?? []"
      type="multiple"
      class="flex flex-col gap-2"
      @update:model-value="onMultiChange"
    >
      <ToggleGroupItem
        v-for="option in field.options"
        :key="option.value"
        :value="option.value"
        class="h-auto justify-start rounded-md px-4 py-3 text-left whitespace-normal"
      >
        {{ option.label }}
      </ToggleGroupItem>
    </ToggleGroup>
    <Input
      v-if="field.allowOther && field.otherFieldId && modelValue === 'other'"
      :model-value="(otherValue as string) ?? ''"
      :placeholder="
        $t(
          `cloudOnboarding.survey.options.${field.id}.otherPlaceholder`,
          $t('cloudOnboarding.survey.otherPlaceholder')
        )
      "
      class="ml-1"
      @update:model-value="onOtherChange"
    />
    <p v-if="errorMessage" class="text-danger text-xs">{{ errorMessage }}</p>
  </fieldset>
  <div v-else class="flex flex-col gap-3">
    <label
      :for="controlId"
      class="block text-lg font-medium text-base-foreground"
    >
      {{ resolvedLabel }}
    </label>
    <Input
      :id="controlId"
      :model-value="(modelValue as string) ?? ''"
      :placeholder="field.placeholder"
      :aria-invalid="Boolean(errorMessage)"
      @update:model-value="onTextChange"
    />
    <p v-if="errorMessage" class="text-danger text-xs">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Input from '@/components/ui/input/Input.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import type { OnboardingSurveyField } from '@/platform/remoteConfig/types'

type RekaSelectionValue =
  | string
  | number
  | bigint
  | Record<string, unknown>
  | null
  | undefined

const {
  field,
  modelValue,
  otherValue,
  errorMessage = ''
} = defineProps<{
  field: OnboardingSurveyField
  modelValue: string | string[] | undefined
  otherValue?: string
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
  'update:otherValue': [value: string]
}>()

const { t, te } = useI18n()
const controlId = useId()

const resolvedLabel = (() => {
  if (field.labelKey && te(field.labelKey)) return t(field.labelKey)
  return field.label ?? field.id
})()

const onSingleChange = (value: RekaSelectionValue | RekaSelectionValue[]) => {
  emit('update:modelValue', typeof value === 'string' ? value : '')
}
const onMultiChange = (value: RekaSelectionValue | RekaSelectionValue[]) => {
  if (!Array.isArray(value)) {
    emit('update:modelValue', [])
    return
  }
  emit(
    'update:modelValue',
    value.filter((v): v is string => typeof v === 'string')
  )
}
const onTextChange = (value: string | number | undefined) => {
  emit('update:modelValue', String(value ?? ''))
}
const onOtherChange = (value: string | number | undefined) => {
  emit('update:otherValue', String(value ?? ''))
}
</script>
