<script setup lang="ts">
import { ImageOff } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { SourcePreviewProps } from '../../composables/useSourceUrl'
import { useSourceUrl } from '../../composables/useSourceUrl'
import { t } from '../../i18n/translations'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import DialogTrigger from '../ui/dialog/DialogTrigger.vue'
import SourceLightbox from './SourceLightbox.vue'

const { file, src, name, locale = 'en' } = defineProps<SourcePreviewProps>()

const source = useSourceUrl(
  () => file,
  () => src
)
const failedSource = ref<string>()
const expanded = ref(false)
const expandLabel = computed(
  () => `${t('workshop.output.expand', {}, { locale: locale })} ${name}`
)
</script>

<template>
  <!-- A thumbnail is too small to judge a source picture by, so it opens to
    the size the screen allows. -->
  <Dialog v-if="source && failedSource !== source" v-model:open="expanded">
    <DialogTrigger as-child>
      <button
        type="button"
        :aria-label="expandLabel"
        class="size-12 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-transparency-white-t8 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      >
        <img
          :key="source"
          :src="source"
          :alt="name"
          referrerpolicy="no-referrer"
          class="size-full object-cover"
          @error="failedSource = source"
        />
      </button>
    </DialogTrigger>

    <SourceLightbox
      :close-label="t('workshop.output.collapse', {}, { locale: locale })"
      data-testid="image-source-dialog"
      @dismiss="expanded = false"
    >
      <DialogTitle class="sr-only">{{ name }}</DialogTitle>
      <img
        :key="source"
        :src="source"
        :alt="name"
        referrerpolicy="no-referrer"
        class="max-h-full max-w-full rounded-2xl bg-black object-contain"
      />
    </SourceLightbox>
  </Dialog>
  <span
    v-else-if="source"
    role="status"
    class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-transparency-white-t8"
  >
    <ImageOff class="size-5 text-primary-warm-gray" aria-hidden="true" />
    <span class="sr-only">{{
      t('workshop.field.imagePreviewUnavailable', {}, { locale: locale })
    }}</span>
  </span>
</template>
