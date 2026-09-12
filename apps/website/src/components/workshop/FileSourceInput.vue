<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { useDropZone } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FieldSchema, FileValue } from '../../config/workshop-playground'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import SelectedFileRow from './SelectedFileRow.vue'

const {
  field,
  describedBy,
  invalid = false,
  disabled = false,
  locale = 'en'
} = defineProps<{
  field: Extract<FieldSchema, { kind: 'file' }>
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
  locale?: Locale
}>()
const value = defineModel<FileValue | FileValue[]>()
const selectedFiles = computed(() =>
  value.value === undefined
    ? []
    : Array.isArray(value.value)
      ? value.value
      : [value.value]
)
const imageOnly = computed(
  () =>
    field.accept.length > 0 &&
    field.accept.every((type) => type.startsWith('image/'))
)
const limit = computed(() => (field.multiple ? field.maxItems : 1))
const rejection = ref<TranslationKey>()
const replacement = ref<number>()
const input = useTemplateRef<HTMLInputElement>('input')
const zone = useTemplateRef<HTMLElement>('zone')
const { isOverDropZone } = useDropZone(zone, {
  onDrop: (files) => choose(files ?? []),
  preventDefaultForUnhandled: true
})
const description = computed(
  () =>
    [describedBy, rejection.value && `selection-error-${field.name}`]
      .filter(Boolean)
      .join(' ') || undefined
)

const prompt = computed(() => {
  const replacing = selectedFiles.value.length > 0 && !field.multiple
  if (replacing)
    return imageOnly.value
      ? 'workshop.field.replaceOrDropImage'
      : 'workshop.field.replaceOrDropFile'
  return imageOnly.value
    ? 'workshop.field.chooseOrDropImages'
    : 'workshop.field.chooseOrDropFiles'
})

const acceptedTypes = computed(() =>
  field.accept
    .map((type) => type.split('/')[1].replace('x-', '').toUpperCase())
    .join(', ')
)

const rejectionMessage = computed(() => {
  if (!rejection.value) return ''
  const unchanged = imageOnly.value
    ? 'workshop.field.imagesUnchanged'
    : 'workshop.field.filesUnchanged'
  return `${t(rejection.value, locale).replace('{count}', String(limit.value))} ${t(unchanged, locale)}`
})

function choose(files: File[], index?: number) {
  if (disabled || !files.length) return
  const incoming = files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    file
  }))
  const next =
    index !== undefined
      ? selectedFiles.value.flatMap((file, position) =>
          position === index ? incoming : [file]
        )
      : field.multiple
        ? [...selectedFiles.value, ...incoming]
        : incoming
  rejection.value =
    limit.value !== undefined && next.length > limit.value
      ? imageOnly.value
        ? 'workshop.field.tooManyImages'
        : 'workshop.field.tooManyFiles'
      : field.accept.length > 0 &&
          files.some((file) => !field.accept.includes(file.type))
        ? 'workshop.form.badType'
        : files.some((file) => file.size > field.maxBytes)
          ? 'workshop.form.tooLarge'
          : undefined
  if (rejection.value) return
  value.value = field.multiple ? next : next[0]
}

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  choose(Array.from(event.target.files ?? []), replacement.value)
  event.target.value = ''
  replacement.value = undefined
}

async function replace(index: number) {
  replacement.value = index
  await nextTick()
  input.value?.click()
}

function remove(index: number) {
  const remaining = selectedFiles.value.filter(
    (_, position) => position !== index
  )
  value.value = remaining.length
    ? field.multiple
      ? remaining
      : remaining[0]
    : undefined
  rejection.value = undefined
}
</script>

<template>
  <div
    ref="zone"
    role="group"
    :aria-label="field.label"
    :class="
      cn(
        'focus-within:ring-primary-comfy-yellow flex min-w-0 flex-col gap-3 rounded-2xl border border-dashed focus-within:ring-2',
        isOverDropZone && !disabled
          ? 'border-primary-comfy-yellow'
          : 'border-transparency-white-t20',
        disabled && 'opacity-50'
      )
    "
  >
    <ul
      v-if="selectedFiles.length"
      class="flex min-w-0 flex-col gap-2 px-3 pt-3"
    >
      <SelectedFileRow
        v-for="(file, index) in selectedFiles"
        :key="index"
        :file
        :disabled
        :locale
        @replace="replace(index)"
        @remove="remove(index)"
      />
    </ul>
    <label
      :for="`field-${field.name}`"
      :class="
        cn(
          'hover:bg-transparency-white-t4 flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-xs text-primary-warm-gray',
          disabled && 'pointer-events-none'
        )
      "
      @click="replacement = undefined"
    >
      <Upload class="size-5" aria-hidden="true" />
      <span>{{ t(prompt, locale) }}</span>
      <span>
        <template v-if="acceptedTypes">{{ acceptedTypes }} · </template>
        {{ t('workshop.field.uploadLimit', locale) }}
      </span>
    </label>
    <input
      :id="`field-${field.name}`"
      ref="input"
      type="file"
      :multiple="field.multiple && replacement === undefined"
      :accept="field.accept.join(',')"
      :disabled
      :aria-label="field.label"
      :aria-required="field.required"
      :aria-invalid="invalid || !!rejection"
      :aria-describedby="description"
      :data-testid="`field-${field.name}`"
      class="sr-only"
      @change="onChange"
      @cancel="replacement = undefined"
    />
    <p
      v-if="rejection"
      :id="`selection-error-${field.name}`"
      role="alert"
      class="text-primary-comfy-red text-xs"
    >
      {{ rejectionMessage }}
    </p>
  </div>
</template>
