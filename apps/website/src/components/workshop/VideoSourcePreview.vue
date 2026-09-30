<script setup lang="ts">
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
const expandLabel = computed(
  () => `${t('workshop.output.expand', {}, { locale: locale })} ${name}`
)
const expanded = ref(false)
</script>

<template>
  <Dialog v-if="source" v-model:open="expanded">
    <DialogTrigger as-child>
      <button
        type="button"
        :aria-label="expandLabel"
        class="size-12 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-transparency-white-t8 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      >
        <video
          :key="source"
          :src="source"
          aria-hidden="true"
          muted
          playsinline
          preload="metadata"
          class="size-full object-cover"
          data-testid="video-source-thumbnail"
        />
      </button>
    </DialogTrigger>

    <SourceLightbox
      :close-label="t('workshop.output.collapse', {}, { locale: locale })"
      data-testid="video-source-dialog"
      @dismiss="expanded = false"
    >
      <DialogTitle class="sr-only">{{ name }}</DialogTitle>
      <video
        :key="source"
        :src="source"
        :aria-label="name"
        controls
        playsinline
        preload="metadata"
        class="max-h-full max-w-full rounded-2xl bg-black object-contain"
      />
    </SourceLightbox>
  </Dialog>
</template>
