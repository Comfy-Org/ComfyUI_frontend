<script setup lang="ts">
import { Upload, X } from '@lucide/vue'
import { useDropZone } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'

import type { FieldSchema, FileValue } from '../../config/workshop-playground'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ImageSourcePreview from './ImageSourcePreview.vue'
import VideoSourcePreview from './VideoSourcePreview.vue'

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

function fileType(file: FileValue): string {
  return (
    /\.([a-z\d]{1,12})$/i.exec(file.name)?.[1].toUpperCase() ??
    t('workshop.field.file', locale)
  )
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
      <li
        v-for="(file, index) in selectedFiles"
        :key="index"
        class="bg-transparency-white-t4 flex min-w-0 items-center gap-3 rounded-xl p-2"
      >
        <ImageSourcePreview
          v-if="file.type.startsWith('image/')"
          :file="file.file"
          :src="file.previewUrl"
          :name="file.name"
          :locale
        />
        <VideoSourcePreview
          v-else-if="file.type.startsWith('video/')"
          :file="file.file"
          :src="file.previewUrl"
          :name="file.name"
        />
        <span
          v-else
          class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-transparency-white-t8 text-xs font-bold text-primary-warm-gray"
        >
          {{ fileType(file) }}
        </span>
        <button
          type="button"
          :disabled
          :aria-label="
            t('workshop.field.replaceFile', locale).replace('{name}', file.name)
          "
          class="focus-visible:outline-primary-comfy-yellow min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-primary-warm-white underline-offset-4 hover:underline"
          @click="replace(index)"
        >
          {{ file.name }}
        </button>
        <span
          v-if="file.size"
          class="shrink-0 text-xs text-primary-warm-gray"
          >{{ formatSize(file.size) }}</span
        >
        <button
          type="button"
          :disabled
          :aria-label="
            t('workshop.field.removeNamedFile', locale).replace(
              '{name}',
              file.name
            )
          "
          class="focus-visible:outline-primary-comfy-yellow flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white"
          @click="remove(index)"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </li>
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
      <span>{{
        t(
          selectedFiles.length && !field.multiple
            ? imageOnly
              ? 'workshop.field.replaceOrDropImage'
              : 'workshop.field.replaceOrDropFile'
            : imageOnly
              ? 'workshop.field.chooseOrDropImages'
              : 'workshop.field.chooseOrDropFiles',
          locale
        )
      }}</span>
      <span>
        <template v-if="field.accept.length"
          >{{
            field.accept
              .map((type) => type.split('/')[1].replace('x-', '').toUpperCase())
              .join(', ')
          }}
          ·
        </template>
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
      {{ t(rejection, locale).replace('{count}', String(limit)) }}
      {{
        t(
          imageOnly
            ? 'workshop.field.imagesUnchanged'
            : 'workshop.field.filesUnchanged',
          locale
        )
      }}
    </p>
  </div>
</template>
