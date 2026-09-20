<script setup lang="ts">
import { Upload } from '@lucide/vue'
import { useDropZone } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FieldSchema, FileValue } from '../../config/workshop-playground'
import { formatWorkshopUploadLimit } from '../../config/workshop-limits'
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

// A full field has nothing left to take, and a drop zone under the files it
// already holds reads as an upload still waiting to happen. Dropping onto the
// files themselves still works: the zone is the whole group, not the label.
const atCapacity = computed(
  () => limit.value !== undefined && selectedFiles.value.length >= limit.value
)
const uploadLimit = computed(() =>
  formatWorkshopUploadLimit(field.maxBytes, locale)
)
const rejection = ref<TranslationKey>()
const replacement = ref<number>()
const input = useTemplateRef<HTMLInputElement>('input')
const zone = useTemplateRef<HTMLElement>('zone')
const { isOverDropZone } = useDropZone(zone, {
  onDrop: (files) => choose(files ?? []),
  preventDefaultForUnhandled: true
})
const dropZoneActive = computed(() => isOverDropZone.value && !disabled)
const description = computed(
  () =>
    [describedBy, rejection.value && `selection-error-${field.name}`]
      .filter(Boolean)
      .join(' ') || undefined
)

// A field that takes one file would be at capacity the moment it holds one, so
// the singular copy only ever greets an empty field.
const prompt = computed(() => {
  const allowed = field.multiple ? field.maxItems : undefined
  if (allowed !== undefined && allowed > 1)
    return t(
      imageOnly.value
        ? 'workshop.field.selectOrDropImages'
        : 'workshop.field.selectOrDropFiles',
      locale
    ).replace('{count}', String(allowed))
  return t(
    imageOnly.value
      ? 'workshop.field.selectOrDropImage'
      : 'workshop.field.selectOrDropFile',
    locale
  )
})

const acceptedTypes = computed(() =>
  field.accept
    .map((type) => {
      if (type.endsWith('/*')) return type.slice(0, -2).toUpperCase()
      const label = type.includes('/') ? type.split('/').at(-1) : type
      return (label ?? type).replace(/^x-/, '').replace(/^\./, '').toUpperCase()
    })
    .join(', ')
)

const rejectionMessage = computed(() => {
  if (!rejection.value) return ''
  const unchanged = imageOnly.value
    ? 'workshop.field.imagesUnchanged'
    : 'workshop.field.filesUnchanged'
  return `${t(rejection.value, locale).replace('{count}', String(limit.value)).replace('{limit}', uploadLimit.value)} ${t(unchanged, locale)}`
})

function accepts(file: File): boolean {
  if (field.accept.length === 0) return true
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()
  return field.accept.some((raw) => {
    const accepted = raw.toLowerCase()
    if (accepted.startsWith('.')) return name.endsWith(accepted)
    if (accepted.endsWith('/*')) return mime.startsWith(accepted.slice(0, -1))
    if (accepted.includes('/')) return mime === accepted
    return name.endsWith(`.${accepted}`)
  })
}

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
      : files.some((file) => !accepts(file))
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
        'flex min-w-0 flex-col gap-3 rounded-2xl has-focus-visible:ring-2 has-focus-visible:ring-primary-comfy-yellow',
        disabled && 'opacity-50'
      )
    "
  >
    <ul v-if="selectedFiles.length" class="flex min-w-0 flex-col gap-2">
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
      v-if="!atCapacity"
      :for="`field-${field.name}`"
      :class="
        cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-xs text-primary-warm-gray hover:bg-transparency-white-t4',
          dropZoneActive
            ? 'border-primary-comfy-yellow'
            : 'border-transparency-white-t20',
          disabled && 'pointer-events-none'
        )
      "
      @click="replacement = undefined"
    >
      <Upload class="size-5" aria-hidden="true" />
      <span>{{ prompt }}</span>
      <span class="text-2xs">
        <template v-if="acceptedTypes">{{ acceptedTypes }} · </template>
        {{
          t('workshop.field.uploadLimit', locale).replace(
            '{limit}',
            uploadLimit
          )
        }}
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
      class="px-3 pb-3 text-xs text-primary-comfy-red"
    >
      {{ rejectionMessage }}
    </p>
  </div>
</template>
