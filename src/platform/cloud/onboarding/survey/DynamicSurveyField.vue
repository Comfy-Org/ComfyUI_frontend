<template>
  <fieldset
    v-if="field.type !== 'text'"
    :aria-invalid="Boolean(errorMessage)"
    class="flex flex-col gap-4 border-0 p-0"
  >
    <legend class="mb-2 block text-lg font-medium text-base-foreground">
      {{ resolvedLabel }}
    </legend>
    <template v-if="field.type === 'single'">
      <div
        v-for="option in field.options"
        :key="option.value"
        class="flex items-center gap-3"
      >
        <RadioButton
          :model-value="(modelValue as string) ?? ''"
          :input-id="`${field.id}-${option.value}`"
          :name="field.id"
          :value="option.value"
          @update:model-value="onSingleChange"
        />
        <label
          :for="`${field.id}-${option.value}`"
          class="cursor-pointer text-sm"
          >{{ option.label }}</label
        >
      </div>
    </template>
    <template v-else>
      <div
        v-for="option in field.options"
        :key="option.value"
        class="flex items-center gap-3"
      >
        <Checkbox
          :model-value="(modelValue as string[]) ?? []"
          :input-id="`${field.id}-${option.value}`"
          :value="option.value"
          @update:model-value="onMultiChange"
        />
        <label
          :for="`${field.id}-${option.value}`"
          class="cursor-pointer text-sm"
          >{{ option.label }}</label
        >
      </div>
    </template>
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
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Input from '@/components/ui/input/Input.vue'
import type { OnboardingSurveyField } from '@/platform/remoteConfig/types'

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

const onSingleChange = (value: unknown) => {
  emit('update:modelValue', typeof value === 'string' ? value : '')
}
const onMultiChange = (value: unknown) => {
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

<style scoped>
:deep(.p-radiobutton-checked .p-radiobutton-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
</style>
