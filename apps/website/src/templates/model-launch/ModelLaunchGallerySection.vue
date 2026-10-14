<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, shallowRef, useTemplateRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchGallery } from './types'

import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { translationsFor } from '@/i18n/translations'
import ModelLaunchGalleryCard from './ModelLaunchGalleryCard.vue'

type GalleryCard = ModelLaunchGallery['cards'][number]

const { locale = 'en', gallery } = defineProps<{
  gallery: ModelLaunchGallery
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const gapClass =
  gallery.captionPlacement === 'overlay' ? 'gap-2' : 'gap-x-6 gap-y-10'

const expanded = shallowRef<{
  src: string
  name: string
  description: string
} | null>(null)
function expand(card: GalleryCard) {
  expanded.value = {
    src: card.media.src,
    name: card.name[locale] || card.name.en,
    description: card.description[locale] || card.description.en
  }
}
function closeLightboxWhenDismissed(open: boolean) {
  if (!open) expanded.value = null
}

const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const shouldLoadVideos = ref(false)
const { stop } = useIntersectionObserver(
  sectionRef,
  ([entry]) => {
    if (!entry?.isIntersecting) return
    shouldLoadVideos.value = true
    stop()
  },
  { rootMargin: '200px' }
)
</script>

<template>
  <section
    ref="sectionRef"
    class="mx-auto max-w-9xl px-4 py-16 lg:px-20 lg:py-24"
  >
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(gallery.headingKey) }}
      </h2>
    </div>

    <div
      data-testid="model-launch-gallery-grid"
      :class="
        cn('mx-auto mt-16 grid max-w-7xl grid-cols-1 md:grid-cols-2', gapClass)
      "
    >
      <ModelLaunchGalleryCard
        v-for="card in gallery.cards"
        :key="card.id"
        :card
        :locale
        :cta-variant="gallery.ctaVariant"
        :card-meta="gallery.cardMeta"
        :caption-placement="gallery.captionPlacement"
        :load-video="shouldLoadVideos"
        :class="cn(card.span === 'full' && 'md:col-span-full')"
        @expand="expand(card)"
      />
    </div>

    <Dialog :open="expanded !== null" @update:open="closeLightboxWhenDismissed">
      <DialogContent
        v-if="expanded"
        :close-label="t('gallery.detail.close')"
        class="max-w-none border-0 bg-transparent p-0 sm:max-w-none sm:p-0 lg:p-0"
      >
        <DialogTitle class="sr-only">{{ expanded.name }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ expanded.description }}
        </DialogDescription>
        <img
          :src="expanded.src"
          :alt="expanded.name"
          class="w-full rounded-3xl"
        />
      </DialogContent>
    </Dialog>
  </section>
</template>
