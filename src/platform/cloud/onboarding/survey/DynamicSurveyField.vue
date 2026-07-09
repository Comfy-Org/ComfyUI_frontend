<template>
  <fieldset
    v-if="field.type !== 'text'"
    :aria-invalid="Boolean(errorMessage)"
    class="m-0 flex flex-col gap-4 border-0 p-0"
  >
    <legend class="mb-2 block text-lg font-medium text-primary-comfy-canvas">
      {{ resolvedLabel }}
    </legend>
    <ToggleGroup
      v-if="field.type === 'single'"
      v-model="stringValue"
      type="single"
      class="flex w-full flex-col gap-2"
    >
      <ToggleGroupItem
        v-for="option in field.options"
        :id="`${field.id}-${option.value}`"
        :key="option.value"
        :value="option.value"
        :class="optionCardClass"
      >
        <i
          v-if="option.icon"
          :class="
            cn('size-4 shrink-0 text-primary-comfy-canvas/60', option.icon)
          "
          aria-hidden="true"
        />
        <span class="flex-1">{{ resolveOptionLabel(option) }}</span>
        <i :class="checkMarkClass" aria-hidden="true" />
      </ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup
      v-else
      v-model="multiValue"
      type="multiple"
      class="flex w-full flex-col gap-2"
    >
      <ToggleGroupItem
        v-for="option in field.options"
        :id="`${field.id}-${option.value}`"
        :key="option.value"
        :value="option.value"
        :class="optionCardClass"
      >
        <i
          v-if="option.icon"
          :class="
            cn('size-4 shrink-0 text-primary-comfy-canvas/60', option.icon)
          "
          aria-hidden="true"
        />
        <span class="flex-1">{{ resolveOptionLabel(option) }}</span>
        <i :class="checkMarkClass" aria-hidden="true" />
      </ToggleGroupItem>
    </ToggleGroup>
    <Input
      v-if="field.allowOther && field.otherFieldId && isOtherSelected"
      v-model="otherValue"
      :class="inputClass"
      :maxlength="OTHER_TEXT_MAX_LENGTH"
      :placeholder="
        $t(
          `cloudOnboarding.survey.options.${field.id}.otherPlaceholder`,
          $t('cloudOnboarding.survey.otherPlaceholder')
        )
      "
    />
    <p v-if="errorMessage" class="text-danger text-xs">{{ errorMessage }}</p>
  </fieldset>
  <div v-else class="flex flex-col gap-3">
    <label
      :for="controlId"
      class="block text-lg font-medium text-primary-comfy-canvas"
    >
      {{ resolvedLabel }}
    </label>
    <Input
      :id="controlId"
      v-model="stringValue"
      :placeholder="field.placeholder"
      :aria-invalid="Boolean(errorMessage)"
      :class="inputClass"
    />
    <p v-if="errorMessage" class="text-danger text-xs">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Input from '@/components/ui/input/Input.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  LocalizedString,
  OnboardingSurveyField,
  OnboardingSurveyOption
} from '@/platform/remoteConfig/types'

import { OTHER_TEXT_MAX_LENGTH } from './surveySchema'

const modelValue = defineModel<string | string[]>()
const otherValue = defineModel<string>('otherValue')

const { field, errorMessage = '' } = defineProps<{
  field: OnboardingSurveyField
  errorMessage?: string
}>()

const stringValue = computed({
  get: () => (typeof modelValue.value === 'string' ? modelValue.value : ''),
  set: (value) => (modelValue.value = value)
})

const multiValue = computed({
  get: () => (Array.isArray(modelValue.value) ? modelValue.value : []),
  set: (value) => (modelValue.value = value)
})

const { t, te, locale } = useI18n()
const controlId = useId()

const optionCardClass =
  'group h-auto w-full items-center justify-start gap-3 rounded-md border border-solid border-smoke-800/10 bg-smoke-800/10 px-4 py-3 text-left text-sm text-primary-comfy-canvas shadow-inset-highlight transition-colors hover:bg-sand-300/20 data-[state=on]:bg-sand-300/15 data-[state=on]:ring-1 data-[state=on]:ring-inset data-[state=on]:ring-brand-yellow'

const checkMarkClass =
  'icon-[lucide--check] size-4 shrink-0 text-brand-yellow opacity-0 group-data-[state=on]:opacity-100'

const inputClass =
  'border-smoke-800/10 bg-smoke-800/10 text-primary-comfy-canvas placeholder:text-primary-comfy-canvas/50 focus-visible:ring-inset'

const isOtherSelected = computed(() =>
  Array.isArray(modelValue.value)
    ? modelValue.value.includes('other')
    : modelValue.value === 'other'
)

const resolveLocalized = (value: LocalizedString): string => {
  if (typeof value === 'string') return value
  return value[locale.value] ?? value.en ?? Object.values(value)[0] ?? ''
}

const resolvedLabel = computed(() => {
  if (field.labelKey && te(field.labelKey)) return t(field.labelKey)
  if (field.label != null) return resolveLocalized(field.label)
  return field.id
})

const resolveOptionLabel = (option: OnboardingSurveyOption): string => {
  if (option.labelKey && te(option.labelKey)) return t(option.labelKey)
  if (option.label != null) return resolveLocalized(option.label)
  return option.value
}
</script>
