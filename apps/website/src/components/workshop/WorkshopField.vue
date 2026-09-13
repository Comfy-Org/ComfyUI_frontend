<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import type {
  WorkshopField,
  WorkshopFormValue,
  WorkshopFormValues
} from '../../config/workshop-detail'
import { parseWorkshopJsonInput } from '../../config/workshop-json-schema'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { field, locale = 'en' } = defineProps<{
  field: WorkshopField
  locale?: Locale
}>()
const values = defineModel<WorkshopFormValues>({ required: true })
/**
 * A validation message the visitor can actually see.
 *
 * `setCustomValidity` alone was invisible here: the only submit control is
 * disabled, so the browser never surfaces it and the field failed silently.
 */
const error = ref('')
const controlId = `workshop-field-${field.name}`
const errorId = `${controlId}-error`
const labelId = `${controlId}-label`
const hintId = `${controlId}-hint`
const hint = computed(() => ('hint' in field ? field.hint : undefined))

/** Both the hint and any error, so a screen reader is told about the failure. */
const describedBy = computed(() => {
  const ids = [
    hint.value ? hintId : undefined,
    error.value ? errorId : undefined
  ].filter((id) => id !== undefined)
  return ids.length > 0 ? ids.join(' ') : undefined
})

function set(value: WorkshopFormValue) {
  values.value = { ...values.value, [field.name]: value }
}

function textValue(): string {
  const value = values.value[field.name]
  return typeof value === 'string' ? value : ''
}

function numberValue(): number | undefined {
  const value = values.value[field.name]
  return typeof value === 'number' ? value : undefined
}

function booleanValue(): boolean {
  return values.value[field.name] === true
}

function onText(event: Event) {
  const input = event.target as HTMLInputElement | HTMLTextAreaElement
  const value = input.value
  const invalid =
    field.kind === 'text' &&
    field.valueType === 'json' &&
    value !== '' &&
    !parseWorkshopJsonInput(value, field.jsonSchema).success

  error.value = invalid ? t('workshop.model.invalidJson', locale) : ''
  input.setCustomValidity(error.value)
  set(value)
}

function onNumber(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  set(Number.isNaN(value) ? undefined : value)
}

function onSelect(event: Event) {
  if (field.kind !== 'select') return
  const placeholderOffset = field.defaultValue === undefined ? 1 : 0
  const index =
    (event.target as HTMLSelectElement).selectedIndex - placeholderOffset
  set(index < 0 ? undefined : field.options[index])
}

function onMedia(event: Event) {
  if (field.kind !== 'media') return
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (field.maxItems !== undefined && files.length > field.maxItems) {
    error.value = t('workshop.model.maxFiles', locale).replace(
      '{count}',
      String(field.maxItems)
    )
    input.setCustomValidity(error.value)
    // Clear the picker too. Leaving it listing files the form has discarded
    // is what made this look like nothing happened, and keeping a previously
    // valid selection would contradict what the control shows.
    input.value = ''
    set(undefined)
    return
  }
  error.value = ''
  input.setCustomValidity('')
  const uploads = files.map((file) => `<${file.name}>`)
  set(uploads.length === 0 ? undefined : field.multiple ? uploads : uploads[0])
}

const acceptByType = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  file: undefined
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label
      v-if="field.kind !== 'toggle'"
      :for="controlId"
      class="text-sm font-medium text-primary-comfy-canvas"
    >
      {{ field.label }}
      <span v-if="field.required" class="text-primary-comfy-yellow">*</span>
    </label>
    <span
      v-else
      :id="labelId"
      class="text-sm font-medium text-primary-comfy-canvas"
    >
      {{ field.label }}
      <span v-if="field.required" class="text-primary-comfy-yellow">*</span>
    </span>
    <span v-if="hint" :id="hintId" class="text-xs text-primary-comfy-canvas/55">
      {{ hint }}
    </span>

    <textarea
      v-if="field.kind === 'text' && field.multiline"
      :id="controlId"
      :value="textValue()"
      :required="field.required"
      :minlength="field.minLength"
      :maxlength="field.maxLength"
      :aria-describedby="describedBy"
      rows="5"
      class="focus:border-primary-comfy-yellow min-h-32 resize-y rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 py-3 font-mono text-sm text-primary-comfy-canvas outline-none"
      @input="onText"
    />
    <input
      v-else-if="field.kind === 'text'"
      :id="controlId"
      type="text"
      :value="textValue()"
      :required="field.required"
      :minlength="field.minLength"
      :maxlength="field.maxLength"
      :list="field.suggestions ? `${field.name}-suggestions` : undefined"
      :aria-describedby="describedBy"
      class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 text-sm text-primary-comfy-canvas outline-none"
      @input="onText"
    />
    <select
      v-else-if="field.kind === 'select'"
      :id="controlId"
      :value="values[field.name] ?? field.defaultValue"
      :required="field.required"
      :aria-describedby="describedBy"
      class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink px-4 text-sm text-primary-comfy-canvas outline-none"
      @change="onSelect"
    >
      <option v-if="field.defaultValue === undefined" value="">
        {{ t('workshop.model.select', locale) }}
      </option>
      <!--
        `selected` rather than relying on the select's `:value`. A `value`
        attribute on a server-rendered <select> is inert — the browser picks
        the first option instead — so 71 model pages showed an option that
        contradicted the form state until hydration corrected it.
      -->
      <option
        v-for="option in field.options"
        :key="String(option)"
        :value="option"
        :selected="option === (values[field.name] ?? field.defaultValue)"
      >
        {{ option }}
      </option>
    </select>
    <input
      v-else-if="field.kind === 'number'"
      :id="controlId"
      type="number"
      :value="numberValue()"
      :required="field.required"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :aria-describedby="describedBy"
      class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 text-sm text-primary-comfy-canvas outline-none"
      @input="onNumber"
    />
    <button
      v-else-if="field.kind === 'toggle'"
      type="button"
      role="switch"
      :aria-checked="booleanValue()"
      :aria-labelledby="labelId"
      :aria-describedby="describedBy"
      :class="
        cn(
          'relative h-7 w-12 rounded-full transition-colors',
          booleanValue()
            ? 'bg-primary-comfy-yellow'
            : 'bg-primary-comfy-canvas/20'
        )
      "
      @click="set(!booleanValue())"
    >
      <span
        :class="
          cn(
            'absolute top-1 left-1 size-5 rounded-full bg-primary-comfy-ink transition-transform',
            booleanValue() && 'translate-x-5'
          )
        "
      />
    </button>
    <input
      v-else-if="field.kind === 'media'"
      :id="controlId"
      type="file"
      :required="field.required"
      :multiple="field.multiple"
      :accept="acceptByType[field.accept]"
      :aria-describedby="describedBy"
      class="file:bg-primary-comfy-yellow rounded-xl border border-dashed border-primary-comfy-canvas/20 bg-primary-comfy-canvas/5 p-4 text-sm text-primary-comfy-canvas file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-primary-comfy-ink"
      @change="onMedia"
    />
    <!--
      Values the schema names without restricting the field to them, e.g. the
      stock voices on a text-to-speech model. Offered as completions rather
      than a closed dropdown so a caller's own value stays typable.
    -->
    <datalist
      v-if="field.kind === 'text' && field.suggestions"
      :id="`${field.name}-suggestions`"
    >
      <option
        v-for="option in field.suggestions"
        :key="String(option)"
        :value="option"
      />
    </datalist>

    <p v-if="error" :id="errorId" role="alert" class="text-sm text-red-400">
      {{ error }}
    </p>
  </div>
</template>
