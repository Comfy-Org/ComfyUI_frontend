<template>
  <form class="flex w-full flex-col" @submit.prevent="onSubmit">
    <p v-if="introText" class="mb-4 text-sm text-muted-foreground">
      {{ introText }}
    </p>
    <div
      class="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-secondary-background"
    >
      <div
        class="h-full bg-brand-yellow transition-[width] duration-300 ease-out"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <div v-if="currentField" :key="currentField.id" class="flex flex-col gap-4">
      <DynamicSurveyField
        :field="currentField"
        :model-value="values[currentField.id]"
        :other-value="
          currentField.otherFieldId
            ? (values[currentField.otherFieldId] as string)
            : undefined
        "
        :error-message="currentError"
        @update:model-value="(value) => onFieldChange(currentField.id, value)"
        @update:other-value="
          (value) =>
            currentField.otherFieldId &&
            onFieldChange(currentField.otherFieldId, value)
        "
      />
    </div>

    <div class="mt-8 flex gap-4">
      <Button
        v-if="!isFirst"
        type="button"
        variant="secondary"
        size="lg"
        class="flex-1"
        @click="goPrevious"
      >
        <i class="icon-[lucide--chevron-left] size-4" aria-hidden="true" />
        {{ $t('g.back') }}
      </Button>
      <span v-else class="flex-1" />
      <Button
        v-if="!isLast"
        type="button"
        size="lg"
        :disabled="!isCurrentValid"
        class="flex-1 bg-brand-yellow text-primary-comfy-ink hover:bg-brand-yellow/85"
        @click="goNext"
      >
        {{ $t('g.next') }}
        <i class="icon-[lucide--chevron-right] size-4" aria-hidden="true" />
      </Button>
      <Button
        v-else
        type="submit"
        size="lg"
        :disabled="!isCurrentValid || isSubmitting"
        :loading="isSubmitting"
        class="flex-1 bg-brand-yellow text-primary-comfy-ink hover:bg-brand-yellow/85"
      >
        {{ $t('g.submit') }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  OnboardingSurvey,
  OnboardingSurveyField
} from '@/platform/remoteConfig/types'

import DynamicSurveyField from './DynamicSurveyField.vue'
import {
  buildInitialValues,
  buildSubmissionPayload,
  buildZodSchema,
  prepareSurvey,
  visibleFields
} from './surveySchema'
import type { SurveyValues } from './surveySchema'

const { survey } = defineProps<{
  survey: OnboardingSurvey
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: Record<string, unknown>]
}>()

const { t, te } = useI18n()

const preparedSurvey = computed(() => prepareSurvey(survey))

const introText = computed(() => {
  const key = preparedSurvey.value.introKey
  if (!key) return ''
  return te(key) ? t(key) : ''
})

const liveValues = ref<SurveyValues>(buildInitialValues(preparedSurvey.value))

const validationSchema = computed(() =>
  toTypedSchema(buildZodSchema(preparedSurvey.value, liveValues.value, t))
)

const { values, errors, setFieldValue, validate, resetForm } =
  useForm<SurveyValues>({
    initialValues: liveValues.value,
    validationSchema
  })

watch(
  () => survey,
  () => {
    const fresh = buildInitialValues(preparedSurvey.value)
    liveValues.value = { ...fresh }
    resetForm({ values: fresh })
    stepIndex.value = 0
    touched.value = new Set()
  }
)

const visible = computed(() =>
  visibleFields(preparedSurvey.value, values as SurveyValues)
)
const stepIndex = ref(0)
const touched = ref(new Set<string>())

const currentField = computed(() => visible.value[stepIndex.value])
const isFirst = computed(() => stepIndex.value === 0)
const isLast = computed(() => stepIndex.value === visible.value.length - 1)

const currentError = computed(() => {
  const field = currentField.value
  if (!field || !touched.value.has(field.id)) return undefined
  return (
    errors.value[field.id] ??
    (field.otherFieldId ? errors.value[field.otherFieldId] : undefined)
  )
})

const totalSteps = computed(() => Math.max(visible.value.length, 1))
const progressPercent = computed(() =>
  Math.max(
    100 / totalSteps.value,
    ((stepIndex.value + 1) / totalSteps.value) * 100
  )
)

const isCurrentValid = computed(() => {
  const field = currentField.value
  if (!field) return false

  const value = values[field.id]
  const isEmpty =
    field.type === 'multi'
      ? !Array.isArray(value) || value.length === 0
      : typeof value !== 'string' || value.length === 0

  if (isEmpty) return !field.required

  if (field.allowOther && field.otherFieldId && value === 'other') {
    const other = values[field.otherFieldId]
    return typeof other === 'string' && other.trim().length > 0
  }
  return true
})

const isAutoAdvanceValue = (field: OnboardingSurveyField, value: unknown) =>
  field.type === 'single' && typeof value === 'string' && value !== 'other'

const markTouched = (id: string) => {
  touched.value = new Set(touched.value).add(id)
}

const onFieldChange = async (id: string, value: string | string[]) => {
  markTouched(id)
  setFieldValue(id, value)
  liveValues.value = { ...liveValues.value, [id]: value }
  if (stepIndex.value > visible.value.length - 1) {
    stepIndex.value = Math.max(0, visible.value.length - 1)
  }

  const field = currentField.value
  if (field?.id === id && isAutoAdvanceValue(field, value)) {
    await nextTick()
    goNext()
  }
}

const goNext = () => {
  if (stepIndex.value < visible.value.length - 1) stepIndex.value += 1
}
const goPrevious = () => {
  if (stepIndex.value > 0) stepIndex.value -= 1
}

const onSubmit = async () => {
  const field = currentField.value
  if (field) markTouched(field.id)
  const result = await validate()
  if (!result.valid) return
  emit(
    'submit',
    buildSubmissionPayload(preparedSurvey.value, values as SurveyValues)
  )
}
</script>
