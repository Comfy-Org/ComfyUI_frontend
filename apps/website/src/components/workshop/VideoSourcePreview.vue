<script setup lang="ts">
import { Play } from '@lucide/vue'
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
const expandLabel = computed(
  () => `${t('workshop.output.expand', locale)} ${name}`
)
const expanded = ref(false)
</script>

<template>
  <Dialog v-if="source" v-model:open="expanded">
    <DialogTrigger as-child>
      <button
        type="button"
        :aria-label="expandLabel"
        class="group relative size-12 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-transparency-white-t8 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
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
        <span
          class="absolute inset-0 grid place-items-center bg-black/25 text-white transition-colors group-hover:bg-black/40"
          aria-hidden="true"
        >
          <Play class="size-5 fill-current" />
        </span>
      </button>
    </DialogTrigger>

    <DialogContent
      :close-label="t('workshop.output.collapse', locale)"
      :aria-describedby="undefined"
      class="sm:max-w-5xl"
      data-testid="video-source-dialog"
    >
      <DialogTitle class="sr-only">{{ name }}</DialogTitle>
      <video
        :key="source"
        :src="source"
        :aria-label="name"
        controls
        playsinline
        preload="metadata"
        class="max-h-dvh w-full rounded-2xl bg-black object-contain"
      />
    </DialogContent>
  </Dialog>
</template>
