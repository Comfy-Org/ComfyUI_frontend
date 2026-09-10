<script setup lang="ts">
import { File as FileIcon, Upload, X } from '@lucide/vue'
import { useDropZone } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'

import type { FieldSchema, FileValue } from '../../config/workshop-playground'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ImageSourcePreview from './ImageSourcePreview.vue'

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
        'flex min-w-0 flex-col gap-3 rounded-2xl border border-dashed p-3 focus-within:ring-2 focus-within:ring-primary-comfy-yellow',
        isOverDropZone && !disabled
          ? 'border-primary-comfy-yellow'
          : 'border-transparency-white-t20',
        disabled && 'opacity-50'
      )
    "
  >
    <div
      v-if="selectedFiles.length"
      :class="
        cn(
          'grid min-w-0 gap-3',
          imageOnly && selectedFiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
        )
      "
    >
      <div
        v-for="(file, index) in selectedFiles"
        :key="index"
        class="flex min-w-0 flex-col gap-2"
      >
        <ImageSourcePreview
          v-if="file.type.startsWith('image/')"
          :file="file.file"
          :src="file.previewUrl"
          :name="file.name"
          :locale
        />
        <div
          v-else
          class="flex items-center gap-3 rounded-xl bg-transparency-white-t4 p-3 text-sm text-primary-warm-white"
        >
          <FileIcon
            class="size-8 shrink-0 text-primary-warm-gray"
            aria-hidden="true"
          />
          <span class="font-bold">{{ fileType(file) }}</span>
          <span class="ml-auto text-xs text-primary-warm-gray">{{
            formatSize(file.size)
          }}</span>
        </div>
        <div class="flex min-w-0 items-center gap-2">
          <button
            type="button"
            :disabled
            :aria-label="
              t('workshop.field.replaceFile', locale).replace(
                '{name}',
                file.name
              )
            "
            class="min-w-0 flex-1 cursor-pointer truncate text-left text-xs text-primary-warm-white underline underline-offset-4 focus-visible:outline-primary-comfy-yellow"
            @click="replace(index)"
          >
            {{ file.name }}
          </button>
          <button
            type="button"
            :disabled
            :aria-label="
              t('workshop.field.removeNamedFile', locale).replace(
                '{name}',
                file.name
              )
            "
            class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:outline-primary-comfy-yellow"
            @click="remove(index)"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
    <label
      :for="`field-${field.name}`"
      :class="
        cn(
          'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-xs text-primary-warm-gray hover:bg-transparency-white-t4',
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
      class="text-xs text-primary-comfy-red"
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
