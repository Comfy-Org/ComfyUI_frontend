<script setup lang="ts">
import { Upload, X } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  FieldErrorCode,
  FieldErrors,
  FieldSchema,
  FieldValue,
  FormValues
} from '../../config/workshop-playground'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  schema,
  errors,
  locale = 'en',
  disabled = false
} = defineProps<{
  schema: readonly FieldSchema[]
  errors: FieldErrors
  locale?: Locale
  disabled?: boolean
}>()

const values = defineModel<FormValues>({ required: true })

const errorKey: Record<FieldErrorCode, TranslationKey> = {
  required: 'workshop.form.required',
  tooLarge: 'workshop.form.tooLarge',
  badType: 'workshop.form.badType',
  rejected: 'workshop.form.rejected'
}

const inputClass =
  'w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-50'

function set(name: string, value: FieldValue) {
  values.value = { ...values.value, [name]: value }
}

function onText(name: string, event: Event) {
  set(name, (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function onNumber(name: string, event: Event) {
  set(name, Number((event.target as HTMLInputElement).value))
}

function onFile(name: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  set(
    name,
    file ? { name: file.name, size: file.size, type: file.type } : undefined
  )
}

function fileValue(name: string) {
  const value = values.value[name]
  return typeof value === 'object' ? value : undefined
}

function stringValue(name: string): string {
  const value = values.value[name]
  return typeof value === 'string' ? value : ''
}

function numberValue(name: string, fallback: number): number {
  const value = values.value[name]
  return typeof value === 'number' ? value : fallback
}

function booleanValue(name: string, fallback: boolean): boolean {
  const value = values.value[name]
  return typeof value === 'boolean' ? value : fallback
}

function acceptHint(accept: readonly string[]): string {
  return accept
    .map((type) => type.split('/')[1].replace('x-', '').toUpperCase())
    .join(', ')
}
</script>

<template>
  <div class="flex flex-col gap-5" data-testid="playground-form">
    <div
      v-for="field in schema"
      :key="field.name"
      :class="
        cn(
          'flex flex-col gap-1.5',
          field.kind === 'toggle' && 'flex-row items-center justify-between'
        )
      "
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <div class="flex items-baseline justify-between gap-3">
          <label
            :for="`field-${field.name}`"
            class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
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
          <span
            v-if="field.kind === 'number'"
            class="text-xs text-primary-warm-white tabular-nums"
          >
            {{ numberValue(field.name, field.defaultValue) }}
          </span>
        </div>
        <p v-if="field.hint" class="text-xs text-primary-warm-gray/80">
          {{ field.hint }}
        </p>
      </div>

      <textarea
        v-if="field.kind === 'text' && field.multiline"
        :id="`field-${field.name}`"
        :value="stringValue(field.name)"
        :placeholder="field.placeholder"
        :disabled
        :aria-invalid="field.name in errors"
        :data-testid="`field-${field.name}`"
        rows="4"
        :class="cn(inputClass, 'resize-y py-3')"
        @input="onText(field.name, $event)"
      />
      <input
        v-else-if="field.kind === 'text'"
        :id="`field-${field.name}`"
        type="text"
        :value="stringValue(field.name)"
        :placeholder="field.placeholder"
        :disabled
        :aria-invalid="field.name in errors"
        :data-testid="`field-${field.name}`"
        :class="cn(inputClass, 'h-11')"
        @input="onText(field.name, $event)"
      />

      <select
        v-else-if="field.kind === 'select'"
        :id="`field-${field.name}`"
        :value="stringValue(field.name) || field.defaultValue"
        :disabled
        :data-testid="`field-${field.name}`"
        :class="cn(inputClass, 'h-11 cursor-pointer')"
        @change="onText(field.name, $event)"
      >
        <option
          v-for="option in field.options"
          :key="option"
          :value="option"
          class="bg-primary-comfy-ink"
        >
          {{ option }}
        </option>
      </select>

      <input
        v-else-if="field.kind === 'number'"
        :id="`field-${field.name}`"
        type="range"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :value="numberValue(field.name, field.defaultValue)"
        :disabled
        :data-testid="`field-${field.name}`"
        class="accent-primary-comfy-yellow h-2 w-full cursor-pointer disabled:opacity-50"
        @input="onNumber(field.name, $event)"
      />

      <button
        v-else-if="field.kind === 'toggle'"
        :id="`field-${field.name}`"
        type="button"
        role="switch"
        :aria-checked="booleanValue(field.name, field.defaultValue)"
        :disabled
        :data-testid="`field-${field.name}`"
        :class="
          cn(
            'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50',
            booleanValue(field.name, field.defaultValue)
              ? 'bg-primary-comfy-yellow'
              : 'bg-transparency-white-t20'
          )
        "
        @click="set(field.name, !booleanValue(field.name, field.defaultValue))"
      >
        <span
          :class="
            cn(
              'absolute top-0.5 left-0.5 size-5 rounded-full bg-primary-comfy-ink transition-transform',
              booleanValue(field.name, field.defaultValue) && 'translate-x-5'
            )
          "
        />
      </button>

      <template v-else-if="field.kind === 'file'">
        <div
          v-if="fileValue(field.name)"
          class="bg-transparency-white-t4 flex h-11 items-center justify-between gap-3 rounded-2xl border border-transparency-white-t20 px-4 text-sm"
        >
          <span class="truncate text-primary-warm-white">
            {{ fileValue(field.name)?.name }}
          </span>
          <button
            type="button"
            :aria-label="t('workshop.field.remove', locale)"
            :disabled
            class="cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
            @click="set(field.name, undefined)"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>
        <label
          v-else
          :class="
            cn(
              'flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-xs text-primary-warm-gray transition-colors hover:border-transparency-white-t20 hover:text-primary-warm-white',
              field.name in errors
                ? 'border-primary-comfy-orange'
                : 'border-transparency-white-t20',
              disabled && 'pointer-events-none opacity-50'
            )
          "
        >
          <Upload class="size-5" aria-hidden="true" />
          <span class="font-bold tracking-wider uppercase">
            {{ t('workshop.field.upload', locale) }}
          </span>
          <span>
            {{ acceptHint(field.accept) }} ·
            {{ t('workshop.field.uploadLimit', locale) }}
          </span>
          <input
            :id="`field-${field.name}`"
            type="file"
            :accept="field.accept.join(',')"
            :disabled
            :data-testid="`field-${field.name}`"
            class="sr-only"
            @change="onFile(field.name, $event)"
          />
        </label>
      </template>

      <p
        v-if="field.name in errors"
        class="text-primary-comfy-orange text-xs"
        role="alert"
        :data-testid="`error-${field.name}`"
      >
        {{ t(errorKey[errors[field.name]], locale) }}
      </p>
    </div>
  </div>
</template>
