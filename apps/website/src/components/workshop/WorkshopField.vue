<script setup lang="ts">
import type {
  WorkshopField,
  WorkshopFormValue,
  WorkshopFormValues
} from '../../config/workshop-detail'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { field, locale = 'en' } = defineProps<{
  field: WorkshopField
  locale?: Locale
}>()
const values = defineModel<WorkshopFormValues>({ required: true })

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
  set((event.target as HTMLInputElement | HTMLTextAreaElement).value)
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
  const files = [...((event.target as HTMLInputElement).files ?? [])]
  const uploads = files.map((file) => `<${file.name}>`)
  set(
    uploads.length === 0
      ? undefined
      : field.kind === 'media' && field.multiple
        ? uploads
        : uploads[0]
  )
}

const acceptByType = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  file: undefined
}
</script>

<template>
  <label class="flex flex-col gap-2">
    <span class="text-sm font-medium text-primary-comfy-canvas">
      {{ field.label }}
      <span v-if="field.required" class="text-primary-comfy-yellow">*</span>
    </span>
    <span
      v-if="'hint' in field && field.hint"
      class="text-xs text-primary-comfy-canvas/55"
    >
      {{ field.hint }}
    </span>

    <textarea
      v-if="field.kind === 'text' && field.multiline"
      :value="textValue()"
      :required="field.required"
      rows="5"
      class="focus:border-primary-comfy-yellow min-h-32 resize-y rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 py-3 font-mono text-sm text-primary-comfy-canvas outline-none"
      @input="onText"
    />
    <input
      v-else-if="field.kind === 'text'"
      type="text"
      :value="textValue()"
      :required="field.required"
      class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 text-sm text-primary-comfy-canvas outline-none"
      @input="onText"
    />
    <select
      v-else-if="field.kind === 'select'"
      :value="values[field.name] ?? field.defaultValue"
      :required="field.required"
      class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink px-4 text-sm text-primary-comfy-canvas outline-none"
      @change="onSelect"
    >
      <option v-if="field.defaultValue === undefined" value="">
        {{ t('workshop.model.select', locale) }}
      </option>
      <option v-for="option in field.options" :key="option" :value="option">
        {{ option }}
      </option>
    </select>
    <input
      v-else-if="field.kind === 'number'"
      type="number"
      :value="numberValue()"
      :required="field.required"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      class="focus:border-primary-comfy-yellow h-11 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 px-4 text-sm text-primary-comfy-canvas outline-none"
      @input="onNumber"
    />
    <button
      v-else-if="field.kind === 'toggle'"
      type="button"
      role="switch"
      :aria-checked="booleanValue()"
      class="relative h-7 w-12 rounded-full transition-colors"
      :class="
        booleanValue()
          ? 'bg-primary-comfy-yellow'
          : 'bg-primary-comfy-canvas/20'
      "
      @click="set(!booleanValue())"
    >
      <span
        class="absolute top-1 left-1 size-5 rounded-full bg-primary-comfy-ink transition-transform"
        :class="booleanValue() ? 'translate-x-5' : ''"
      />
    </button>
    <input
      v-else-if="field.kind === 'media'"
      type="file"
      :required="field.required"
      :multiple="field.multiple"
      :accept="acceptByType[field.accept]"
      class="file:bg-primary-comfy-yellow rounded-xl border border-dashed border-primary-comfy-canvas/20 bg-primary-comfy-canvas/5 p-4 text-sm text-primary-comfy-canvas file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-primary-comfy-ink"
      @change="onMedia"
    />
  </label>
</template>
