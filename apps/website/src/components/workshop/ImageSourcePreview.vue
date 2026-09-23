<script setup lang="ts">
import { ImageOff } from '@lucide/vue'
import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import DialogTrigger from '../ui/dialog/DialogTrigger.vue'

const {
  file,
  src,
  name,
  locale = 'en'
} = defineProps<{
  file?: File
  src?: string
  name: string
  locale?: Locale
}>()
const mounted = useMounted()
const objectUrl = useObjectUrl(() => (mounted.value ? file : undefined))
const source = computed(() => objectUrl.value ?? src)
const failedSource = ref<string>()
const expanded = ref(false)
const expandLabel = computed(
  () => `${t('workshop.output.expand', locale)} ${name}`
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

    <DialogContent
      :close-label="t('workshop.output.collapse', locale)"
      :aria-describedby="undefined"
      class="sm:max-w-5xl"
      data-testid="image-source-dialog"
    >
      <DialogTitle class="sr-only">{{ name }}</DialogTitle>
      <img
        :key="source"
        :src="source"
        :alt="name"
        referrerpolicy="no-referrer"
        class="max-h-dvh w-full rounded-2xl bg-black object-contain"
      />
    </DialogContent>
  </Dialog>
  <span
    v-else-if="source"
    role="status"
    class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-transparency-white-t8"
  >
    <ImageOff class="size-5 text-primary-warm-gray" aria-hidden="true" />
    <span class="sr-only">{{
      t('workshop.field.imagePreviewUnavailable', locale)
    }}</span>
  </span>
</template>
