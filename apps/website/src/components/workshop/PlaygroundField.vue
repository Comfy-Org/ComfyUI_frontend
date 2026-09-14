<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  FieldErrorCode,
  FieldErrors,
  FieldSchema,
  FieldValue,
  FormValues
} from '../../config/workshop-playground'
import { urlUploadField, validateForm } from '../../config/workshop-playground'
import { isHttpImageSource } from '../../config/workshop-image-source'
import { workshopExampleFile } from '../../config/workshop-example-file'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FileSourceInput from './FileSourceInput.vue'
import DialogueInput from './DialogueInput.vue'

const {
  field,
  errors,
  locale = 'en',
  disabled = false,
  fileUploadsDisabled = false
} = defineProps<{
  field: FieldSchema
  errors: FieldErrors
  locale?: Locale
  disabled?: boolean
  fileUploadsDisabled?: boolean
}>()

const values = defineModel<FormValues>({ required: true })

const errorKey: Record<FieldErrorCode, TranslationKey> = {
  required: 'workshop.form.required',
  tooLarge: 'workshop.form.tooLarge',
  requestTooLarge: 'workshop.form.requestTooLarge',
  badType: 'workshop.form.badType',
  outOfRange: 'workshop.form.outOfRange',
  badOption: 'workshop.form.badOption',
  uploadFailed: 'workshop.form.uploadFailed',
  rejected: 'workshop.form.rejected'
}

const inputClass =
  'w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-50'

const edited = ref(false)
watch(
  () => errors,
  () => {
    edited.value = false
  }
)
const fieldError = computed(() =>
  edited.value
    ? validateForm([field], values.value)[field.name]
    : errors[field.name]
)
const invalid = () => fieldError.value !== undefined
const declaredDefault = computed(() =>
  field.kind === 'file' ? undefined : field.defaultValue
)
const describedBy = computed(
  () =>
    [
      ...(field.hint ? [`help-${field.name}`] : []),
      ...(declaredDefault.value !== undefined ? [`default-${field.name}`] : []),
      ...(invalid() ? [`error-${field.name}`] : [])
    ].join(' ') || undefined
)

function formatValue(value: string | number | boolean): string {
  const optionLabel = field.presentation?.optionLabels?.[String(value)]
  if (optionLabel) return optionLabel
  if (typeof value === 'boolean')
    return t(value ? 'workshop.field.on' : 'workshop.field.off', locale)
  if (value === 'auto' || value === 'adaptive')
    return t('workshop.field.auto', locale)
  const label =
    typeof value === 'number'
      ? new Intl.NumberFormat(locale).format(value)
      : field.kind === 'select'
        ? value
            .replace(/_/g, ' ')
            .replace(/^[a-z]/, (letter) => letter.toUpperCase())
        : value
  if (field.presentation?.unit !== 'seconds') return label
  const seconds =
    typeof value === 'string' && /^\d+(?:\.\d+)?s$/.test(value)
      ? new Intl.NumberFormat(locale).format(Number(value.slice(0, -1)))
      : label
  return value === -1 || value === '-1'
    ? t('workshop.field.auto', locale)
    : t('workshop.field.seconds', locale).replace('{value}', seconds)
}

const hasEmptyOption = computed(
  () =>
    field.kind === 'select' &&
    (field.defaultValue === undefined || values.value[field.name] === undefined)
)
const isSlider = computed(
  () =>
    field.kind === 'number' &&
    field.presentation?.control !== 'number' &&
    field.min !== undefined &&
    field.max !== undefined &&
    field.defaultValue !== undefined
)
const selectedFiles = computed({
  get() {
    const value = values.value[field.name]
    const upload = urlUploadField(field)
    if (typeof value === 'string' && upload && isHttpImageSource(value)) {
      return (
        workshopExampleFile(value, upload.accept[0]) ?? {
          name: new URL(value).pathname.split('/').at(-1) || field.label,
          type: upload.accept[0] ?? 'application/octet-stream',
          size: 0,
          previewUrl: value,
          sourceUrl: value
        }
      )
    }
    return typeof value === 'object' ? value : undefined
  },
  set
})
const uploadField = computed(() => {
  const upload = urlUploadField(field)
  return upload ? { ...upload, name: `${field.name}-upload` } : undefined
})

function set(value: FieldValue) {
  if (value === values.value[field.name]) return
  edited.value = true
  values.value = { ...values.value, [field.name]: value }
}

function onText(event: Event) {
  set((event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function onNumber(event: Event) {
  const value = (event.target as HTMLInputElement).value
  set(value === '' ? undefined : Number(value))
}

function onSelect(event: Event) {
  if (field.kind !== 'select') return
  const index =
    (event.target as HTMLSelectElement).selectedIndex -
    (hasEmptyOption.value ? 1 : 0)
  set(index < 0 ? undefined : field.options[index])
}

function onOptionalToggle(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  set(value === '' ? undefined : value === 'true')
}

function selectValue(): string {
  if (field.kind !== 'select') return ''
  const value = values.value[field.name]
  const index = field.options.findIndex((option) => option === value)
  return index < 0 ? '' : String(index)
}

function stringValue(): string {
  const value = values.value[field.name]
  return typeof value === 'string' ? value : ''
}

// Painting the filled part ourselves keeps the track identical across browsers,
// which accent-color does not.
function sliderFill(field: {
  min?: number
  max?: number
  defaultValue?: number
}) {
  const min = field.min ?? 0
  const span = (field.max ?? min) - min
  const value = numberValue(field.defaultValue)
  const ratio = span > 0 && typeof value === 'number' ? (value - min) / span : 0
  return `${Math.min(Math.max(ratio, 0), 1) * 100}%`
}

function numberValue(fallback?: number): number | undefined {
  const value = values.value[field.name]
  return typeof value === 'number' ? value : fallback
}

function booleanValue(fallback = false): boolean {
  const value = values.value[field.name]
  return typeof value === 'boolean' ? value : fallback
}
</script>

<template>
  <div
    :class="
      cn(
        'relative flex flex-col gap-2',
        field.kind === 'toggle' && 'flex-row items-center justify-between'
      )
    "
    :data-testid="`field-group-${field.name}`"
  >
    <div class="flex min-w-0 flex-col gap-0.5">
      <div class="flex items-baseline justify-between gap-3">
        <div class="flex items-center gap-2">
          <label
            :for="`field-${uploadField?.name ?? field.name}`"
            class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ field.label }}
            <span
              v-if="'required' in field && field.required"
              class="text-primary-comfy-yellow"
              aria-hidden="true"
            >
              *
            </span>
          </label>
        </div>
        <span
          v-if="field.kind === 'number' && isSlider"
          class="text-xs text-primary-warm-white tabular-nums"
        >
          {{ numberValue(field.defaultValue) }}
        </span>
      </div>
      <p
        v-if="field.hint"
        :id="`help-${field.name}`"
        class="text-xs text-primary-warm-gray"
      >
        {{ field.hint }}
      </p>
      <p
        v-if="declaredDefault !== undefined"
        :id="`default-${field.name}`"
        class="text-xs text-primary-warm-gray"
      >
        {{
          t('workshop.field.defaultValue', locale).replace(
            '{value}',
            formatValue(declaredDefault)
          )
        }}
      </p>
    </div>

    <FileSourceInput
      v-if="uploadField"
      v-model="selectedFiles"
      :field="uploadField"
      :locale
      :disabled="disabled || fileUploadsDisabled"
      :invalid="invalid()"
      :described-by="describedBy"
    />
    <DialogueInput
      v-else-if="
        field.kind === 'text' && field.presentation?.control === 'dialogue'
      "
      :name="field.name"
      :label="field.label"
      :model-value="stringValue()"
      :locale
      :disabled
      :described-by="describedBy"
      @update:model-value="set"
    />
    <textarea
      v-else-if="field.kind === 'text' && field.multiline"
      :id="`field-${field.name}`"
      :value="stringValue()"
      :placeholder="field.placeholder"
      :minlength="field.minLength"
      :disabled
      :aria-required="field.required"
      :aria-invalid="invalid()"
      :aria-describedby="describedBy"
      :data-testid="`field-${field.name}`"
      rows="5"
      :class="cn(inputClass, 'min-h-32 resize-y py-3')"
      @input="onText"
    />
    <input
      v-else-if="field.kind === 'text'"
      :id="`field-${field.name}`"
      type="text"
      :value="stringValue()"
      :placeholder="field.placeholder"
      :minlength="field.minLength"
      :list="
        field.suggestions?.length ? `suggestions-${field.name}` : undefined
      "
      :disabled
      :aria-required="field.required"
      :aria-invalid="invalid()"
      :aria-describedby="describedBy"
      :data-testid="`field-${field.name}`"
      :class="cn(inputClass, 'h-11')"
      @input="onText"
    />

    <div v-else-if="field.kind === 'select'" class="relative">
      <select
        :id="`field-${field.name}`"
        :value="selectValue()"
        :disabled="disabled || (field.options.length === 1 && !hasEmptyOption)"
        :aria-required="field.required || undefined"
        :aria-invalid="invalid()"
        :aria-describedby="describedBy"
        :data-testid="`field-${field.name}`"
        :class="cn(inputClass, 'h-11 cursor-pointer appearance-none pr-10')"
        @change="onSelect"
      >
        <option
          v-if="hasEmptyOption"
          value=""
          :selected="selectValue() === ''"
          class="bg-primary-comfy-ink"
        >
          {{
            t('workshop.field.chooseValue', locale).replace(
              '{label}',
              field.label
            )
          }}
        </option>
        <option
          v-for="(option, index) in field.options"
          :key="index"
          :value="String(index)"
          :selected="selectValue() === String(index)"
          class="bg-primary-comfy-ink"
        >
          {{ formatValue(option) }}
        </option>
      </select>
      <ChevronDown
        class="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-primary-warm-gray"
        aria-hidden="true"
      />
    </div>

    <input
      v-else-if="field.kind === 'number' && isSlider"
      :id="`field-${field.name}`"
      type="range"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :value="numberValue(field.defaultValue)"
      :disabled
      :aria-invalid="invalid()"
      :aria-describedby="describedBy"
      :data-testid="`field-${field.name}`"
      :style="{
        '--slider-fill': `linear-gradient(to right, var(--color-primary-comfy-yellow) 0 ${sliderFill({ min: field.min, max: field.max, defaultValue: field.defaultValue })}, transparent 0 100%)`
      }"
      class="focus-visible:ring-primary-comfy-yellow/50 [&::-moz-range-thumb]:bg-primary-comfy-yellow [&::-moz-range-track]:bg-transparency-white-t4 [&::-moz-range-progress]:bg-primary-comfy-yellow [&::-webkit-slider-runnable-track]:bg-transparency-white-t4 [&::-webkit-slider-thumb]:bg-primary-comfy-yellow h-4 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-none focus-visible:ring-3 disabled:opacity-50 [&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border [&::-moz-range-track]:border-transparency-white-t8 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:border-transparency-white-t8 [&::-webkit-slider-runnable-track]:[background-image:var(--slider-fill)] [&::-webkit-slider-runnable-track]:bg-no-repeat [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
      @input="onNumber"
    />

    <input
      v-else-if="field.kind === 'number'"
      :id="`field-${field.name}`"
      type="number"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :value="numberValue()"
      :disabled
      :aria-required="field.required || undefined"
      :aria-invalid="invalid()"
      :aria-describedby="describedBy"
      :data-testid="`field-${field.name}`"
      :class="cn(inputClass, 'h-11')"
      @input="onNumber"
    />

    <select
      v-else-if="
        field.kind === 'toggle' &&
        field.defaultValue === undefined &&
        !field.required
      "
      :id="`field-${field.name}`"
      :value="
        values[field.name] === undefined ? '' : String(values[field.name])
      "
      :disabled
      :aria-invalid="invalid()"
      :aria-describedby="describedBy"
      :data-testid="`field-${field.name}`"
      :class="cn(inputClass, 'h-11')"
      @change="onOptionalToggle"
    >
      <option value="" :selected="values[field.name] === undefined">
        {{ t('workshop.field.providerDefault', locale) }}
      </option>
      <option value="true" :selected="values[field.name] === true">
        {{ t('workshop.field.on', locale) }}
      </option>
      <option value="false" :selected="values[field.name] === false">
        {{ t('workshop.field.off', locale) }}
      </option>
    </select>

    <button
      v-else-if="field.kind === 'toggle'"
      :id="`field-${field.name}`"
      type="button"
      role="switch"
      :aria-checked="booleanValue(field.defaultValue)"
      :aria-required="field.required || undefined"
      :aria-invalid="invalid()"
      :aria-describedby="describedBy"
      :disabled
      :data-testid="`field-${field.name}`"
      :class="
        cn(
          'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50',
          booleanValue(field.defaultValue)
            ? 'bg-primary-comfy-yellow'
            : 'bg-transparency-white-t20'
        )
      "
      @click="set(!booleanValue(field.defaultValue))"
    >
      <span
        :class="
          cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-primary-comfy-ink transition-transform',
            booleanValue(field.defaultValue) && 'translate-x-5'
          )
        "
      />
    </button>

    <FileSourceInput
      v-else-if="field.kind === 'file'"
      v-model="selectedFiles"
      :field
      :locale
      :disabled="disabled || fileUploadsDisabled"
      :invalid="invalid()"
      :described-by="describedBy"
    />
    <datalist
      v-if="!uploadField && field.kind === 'text' && field.suggestions?.length"
      :id="`suggestions-${field.name}`"
    >
      <option
        v-for="suggestion in field.suggestions"
        :key="String(suggestion)"
        :value="String(suggestion)"
      />
    </datalist>

    <p
      v-if="fieldError"
      :id="`error-${field.name}`"
      class="text-primary-comfy-red text-xs"
      role="alert"
      :data-testid="`error-${field.name}`"
    >
      {{ t(errorKey[fieldError], locale) }}
    </p>
  </div>
</template>
