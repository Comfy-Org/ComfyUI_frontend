<template>
  <form class="flex size-full flex-col" @submit.prevent="onSubmit">
    <p v-if="introText" class="mb-4 text-sm text-muted">
      {{ introText }}
    </p>
    <div
      class="mb-8 h-2 w-full overflow-hidden rounded-full bg-secondary-background"
    >
      <div
        class="h-full transition-[width] duration-300 ease-out"
        :style="{
          width: `${progressPercent}%`,
          backgroundColor: '#f0ff41'
        }"
      />
    </div>

    <div class="flex flex-1 flex-col overflow-hidden">
      <div
        v-if="currentField"
        :key="currentField.id"
        class="flex flex-1 flex-col gap-4 overflow-y-auto pr-1"
      >
        <DynamicSurveyField
          :field="currentField"
          :model-value="values[currentField.id]"
          :other-value="
            currentField.otherFieldId
              ? (values[currentField.otherFieldId] as string)
              : undefined
          "
          :error-message="
            errors[currentField.id] ??
            (currentField.otherFieldId
              ? errors[currentField.otherFieldId]
              : undefined)
          "
          @update:model-value="(value) => onFieldChange(currentField.id, value)"
          @update:other-value="
            (value) =>
              currentField.otherFieldId &&
              onFieldChange(currentField.otherFieldId, value)
          "
        />
      </div>
    </div>

    <div class="flex gap-6 pt-4">
      <Button
        v-if="!isFirst"
        type="button"
        variant="secondary"
        class="h-10 flex-1"
        @click="goPrevious"
      >
        {{ $t('g.back') }}
      </Button>
      <span v-else />
      <Button
        v-if="!isLast"
        type="button"
        :disabled="!isCurrentValid"
        :class="cn('h-10', isFirst ? 'w-full' : 'flex-1')"
        @click="goNext"
      >
        {{ $t('g.next') }}
      </Button>
      <Button
        v-else
        type="submit"
        :disabled="!isCurrentValid || isSubmitting"
        :loading="isSubmitting"
        class="h-10 flex-1"
      >
        {{ $t('g.submit') }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

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
  toTypedSchema(buildZodSchema(preparedSurvey.value, liveValues.value))
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
  }
)

const visible = computed(() =>
  visibleFields(preparedSurvey.value, values as SurveyValues)
)
const stepIndex = ref(0)

const currentField = computed(() => visible.value[stepIndex.value])
const isFirst = computed(() => stepIndex.value === 0)
const isLast = computed(() => stepIndex.value === visible.value.length - 1)

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
  if (field.type === 'multi') {
    return Array.isArray(value) && value.length > 0
  }
  if (typeof value !== 'string' || value.length === 0) return false
  if (field.allowOther && field.otherFieldId && value === 'other') {
    const other = values[field.otherFieldId]
    return typeof other === 'string' && other.trim().length > 0
  }
  return true
})

const onFieldChange = (id: string, value: string | string[]) => {
  setFieldValue(id, value)
  liveValues.value = { ...liveValues.value, [id]: value }
  if (stepIndex.value > visible.value.length - 1) {
    stepIndex.value = Math.max(0, visible.value.length - 1)
  }
}

const goNext = () => {
  if (stepIndex.value < visible.value.length - 1) stepIndex.value += 1
}
const goPrevious = () => {
  if (stepIndex.value > 0) stepIndex.value -= 1
}

const onSubmit = async () => {
  const result = await validate()
  if (!result.valid) return
  emit(
    'submit',
    buildSubmissionPayload(preparedSurvey.value, values as SurveyValues)
  )
}
</script>
