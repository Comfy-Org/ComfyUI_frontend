<template>
  <form class="flex w-full flex-col" @submit.prevent="onSubmit">
    <p v-if="introText" class="mb-4 text-sm text-muted-foreground">
      {{ introText }}
    </p>
    <div
      class="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-primary-comfy-canvas/10"
    >
      <div
        class="h-full bg-brand-yellow transition-[width] duration-300 ease-out"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <div
      class="max-h-[45vh] overflow-y-auto transition-[height] duration-300 ease-out sm:max-h-[55vh]"
      :style="animatedHeightStyle"
    >
      <div ref="questionContent" class="relative">
        <Transition
          enter-active-class="transition-opacity duration-300 ease-out"
          enter-from-class="opacity-0"
          leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
          leave-to-class="opacity-0"
        >
          <div
            v-if="currentField"
            :key="currentField.id"
            class="flex flex-col gap-4"
          >
            <DynamicSurveyField
              :field="currentField"
              :model-value="values[currentField.id]"
              :other-value="
                currentField.otherFieldId
                  ? (values[currentField.otherFieldId] as string)
                  : undefined
              "
              :error-message="currentError"
              @update:model-value="
                (value) => void onFieldChange(currentField.id, value)
              "
              @update:other-value="
                (value) =>
                  currentField.otherFieldId &&
                  void onFieldChange(currentField.otherFieldId, value)
              "
            />
          </div>
        </Transition>
      </div>
    </div>

    <div
      v-if="!isFirst || showNext || isLast"
      class="mt-8 flex items-center justify-between gap-4"
    >
      <Button
        v-if="!isFirst"
        type="button"
        variant="link"
        size="lg"
        class="px-0 text-primary-comfy-canvas/70 hover:text-primary-comfy-canvas"
        @click="goPrevious"
      >
        <i class="icon-[lucide--chevron-left] size-4" aria-hidden="true" />
        {{ $t('g.back') }}
      </Button>
      <span v-else />
      <Button
        v-if="showNext"
        type="button"
        size="lg"
        :disabled="!isCurrentValid"
        class="bg-brand-yellow text-primary-comfy-ink hover:bg-brand-yellow/85 disabled:bg-smoke-800/10 disabled:text-primary-comfy-canvas/40 disabled:opacity-100"
        @click="goNext"
      >
        {{ $t('g.next') }}
        <i class="icon-[lucide--chevron-right] size-4" aria-hidden="true" />
      </Button>
      <Button
        v-else-if="isLast"
        type="submit"
        size="lg"
        :disabled="!isCurrentValid || isSubmitting"
        :loading="isSubmitting"
        class="bg-brand-yellow text-primary-comfy-ink hover:bg-brand-yellow/85 disabled:bg-smoke-800/10 disabled:text-primary-comfy-canvas/40 disabled:opacity-100"
      >
        {{ $t('g.submit') }}
      </Button>
      <span v-else />
    </div>
  </form>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
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
  hasNonEmptyValue,
  isOtherValue,
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
    isAdvancing.value = false
  }
)

const visible = computed(() =>
  visibleFields(preparedSurvey.value, values as SurveyValues)
)
const stepIndex = ref(0)
const touched = ref(new Set<string>())
const isAdvancing = ref(false)

const questionContent = useTemplateRef<HTMLElement>('questionContent')
const { height: contentHeight } = useElementSize(questionContent)
const animatedHeightStyle = computed(() =>
  contentHeight.value ? { height: `${contentHeight.value}px` } : {}
)

const currentField = computed(() => visible.value[stepIndex.value])
const isFirst = computed(() => stepIndex.value === 0)
const isLast = computed(() => stepIndex.value === visible.value.length - 1)

const showNext = computed(() => {
  if (isLast.value || isAdvancing.value) return false
  const field = currentField.value
  if (!field) return false
  if (field.type !== 'single') return true
  return !(field.required && !hasNonEmptyValue(values[field.id]))
})

const currentError = computed(() => {
  const field = currentField.value
  if (!field) return undefined
  if (touched.value.has(field.id) && errors.value[field.id]) {
    return errors.value[field.id]
  }
  if (
    field.otherFieldId &&
    touched.value.has(field.otherFieldId) &&
    errors.value[field.otherFieldId]
  ) {
    return errors.value[field.otherFieldId]
  }
  return undefined
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
  if (!hasNonEmptyValue(value)) return !field.required

  if (field.allowOther && field.otherFieldId && isOtherValue(value)) {
    const other = values[field.otherFieldId]
    return typeof other === 'string' && other.trim().length > 0
  }
  return true
})

const isAutoAdvanceValue = (field: OnboardingSurveyField, value: unknown) =>
  field.type === 'single' &&
  typeof value === 'string' &&
  value !== '' &&
  value !== 'other'

const markTouched = (id: string) => {
  touched.value = new Set(touched.value).add(id)
}

const onFieldChange = async (id: string, value: string | string[]) => {
  if (isAdvancing.value) return
  markTouched(id)
  setFieldValue(id, value)
  liveValues.value = { ...liveValues.value, [id]: value }
  if (stepIndex.value > visible.value.length - 1) {
    stepIndex.value = Math.max(0, visible.value.length - 1)
  }

  const field = currentField.value
  if (field?.id === id && isAutoAdvanceValue(field, value)) {
    isAdvancing.value = true
    await nextTick()
    goNext()
    isAdvancing.value = false
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
  if (field) {
    markTouched(field.id)
    if (field.otherFieldId) markTouched(field.otherFieldId)
  }
  const result = await validate()
  if (!result.valid) return
  emit(
    'submit',
    buildSubmissionPayload(preparedSurvey.value, values as SurveyValues)
  )
}
</script>
