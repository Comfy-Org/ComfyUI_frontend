<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed } from 'vue'

import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'

import type { FileValue } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ImageSourcePreview from './ImageSourcePreview.vue'
import VideoSourcePreview from './VideoSourcePreview.vue'

const {
  file,
  disabled = false,
  locale = 'en'
} = defineProps<{
  file: FileValue
  disabled?: boolean
  locale?: Locale
}>()
defineEmits<{ replace: []; remove: [] }>()

const fileType = computed(
  () =>
    /\.([a-z\d]{1,12})$/i.exec(file.name)?.[1].toUpperCase() ??
    t('workshop.field.file', locale)
)
</script>

<template>
  <li
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
      {{ fileType }}
    </span>
    <button
      type="button"
      :disabled
      :aria-label="
        t('workshop.field.replaceFile', locale).replace('{name}', file.name)
      "
      class="focus-visible:outline-primary-comfy-yellow min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-primary-warm-white underline-offset-4 hover:underline"
      @click="$emit('replace')"
    >
      {{ file.name }}
    </button>
    <span v-if="file.size" class="shrink-0 text-xs text-primary-warm-gray">{{
      formatSize(file.size)
    }}</span>
    <button
      type="button"
      :disabled
      :aria-label="
        t('workshop.field.removeNamedFile', locale).replace('{name}', file.name)
      "
      class="focus-visible:outline-primary-comfy-yellow flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white"
      @click="$emit('remove')"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </li>
</template>
