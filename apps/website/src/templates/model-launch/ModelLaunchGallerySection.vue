<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight, Maximize2 } from '@lucide/vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import type { Locale, LocalizedText } from '@/i18n/translations'
import type { ModelLaunchGallery } from './types'

import BrandButton from '@/components/common/BrandButton.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en', gallery } = defineProps<{
  gallery: ModelLaunchGallery
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const showCardMeta = gallery.cardMeta !== 'none'
const showCardLink = gallery.ctaVariant !== 'none'
const overlayCaptions = gallery.captionPlacement === 'overlay'

const expandedImage = ref<{ src: string; name: LocalizedText } | null>(null)
const expandImage = (card: ModelLaunchGallery['cards'][number]) => {
  if (card.expandable && card.media.kind === 'image') {
    expandedImage.value = { src: card.media.src, name: card.name }
  }
}

const mobileExpanded = ref(false)
const hasMobileOverflow =
  gallery.mobileVisibleCards !== undefined &&
  gallery.cards.length > gallery.mobileVisibleCards
const collapsedOnMobile = (index: number) =>
  hasMobileOverflow &&
  !mobileExpanded.value &&
  index >= (gallery.mobileVisibleCards ?? 0)

// The cards sit well below the fold; defer their videos until the section
// nears the viewport instead of fetching all of them during first paint.
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
        cn(
          'mx-auto mt-16 grid max-w-7xl grid-cols-1',
          overlayCaptions ? 'gap-2' : 'gap-x-6 gap-y-10',
          gallery.columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
        )
      "
    >
      <article
        v-for="(card, index) in gallery.cards"
        :key="card.id"
        :class="
          cn(
            collapsedOnMobile(index) && 'hidden md:block',
            card.span === 'full' && 'md:col-span-full'
          )
        "
      >
        <component
          :is="card.expandable ? 'button' : 'div'"
          data-testid="gallery-card-media"
          :type="card.expandable ? 'button' : undefined"
          :aria-label="card.expandable ? t('player.fullscreen') : undefined"
          :class="
            cn(
              'group relative block w-full overflow-hidden bg-black/40',
              card.expandable && 'cursor-pointer text-left',
              overlayCaptions ? 'rounded-3xl' : 'rounded-4.5xl',
              card.span === 'full'
                ? 'aspect-video md:aspect-3/1'
                : overlayCaptions
                  ? 'aspect-square'
                  : 'aspect-19/10'
            )
          "
          @click="expandImage(card)"
        >
          <video
            v-if="card.media.kind === 'video'"
            :src="shouldLoadVideos ? card.media.src : undefined"
            :poster="card.media.posterSrc"
            :aria-label="card.name[locale] || card.name.en"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            autoplay
            loop
            muted
            playsinline
            preload="none"
          />
          <img
            v-else
            :src="card.media.src"
            :alt="card.name[locale] || card.name.en"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          <div
            :class="
              cn(
                'absolute inset-0',
                overlayCaptions
                  ? 'bg-linear-to-t from-black/60 via-transparent to-transparent'
                  : 'bg-linear-to-b from-black/25 to-transparent'
              )
            "
          />

          <p
            v-if="overlayCaptions"
            :class="
              cn(
                'absolute inset-x-4 bottom-3 text-base/tight font-medium text-primary-warm-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] lg:bottom-4 lg:text-lg',
                card.expandable && 'pr-12 lg:pr-16'
              )
            "
          >
            {{ card.description[locale] || card.description.en }}
          </p>

          <span
            v-if="card.expandable"
            data-testid="gallery-card-expand"
            aria-hidden="true"
            class="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-lg bg-primary-comfy-yellow text-primary-comfy-ink transition-opacity group-hover:opacity-90 lg:right-4 lg:bottom-4 lg:size-10"
          >
            <Maximize2 class="size-3.5 lg:size-4" :stroke-width="2.5" />
          </span>

          <div
            v-if="card.logoSrc"
            aria-hidden="true"
            class="absolute inset-x-8 top-8 flex items-start justify-end"
          >
            <div
              class="flex size-10 items-center justify-center rounded-2xl bg-transparency-white-t20 text-primary-warm-white backdrop-blur-sm transition-colors group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink"
            >
              <span
                class="inline-block size-6 bg-current"
                :style="{
                  maskImage: `url(${card.logoSrc})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center'
                }"
              />
            </div>
          </div>
        </component>

        <div
          v-if="showCardMeta || showCardLink"
          class="mt-5 flex items-center justify-between gap-3"
        >
          <div v-if="showCardMeta" class="flex items-center gap-3">
            <Badge :variant="card.tier === 'free' ? 'accent' : 'callout'">
              {{
                card.tier === 'free'
                  ? t('modelLaunch.tagFree')
                  : t('modelLaunch.tagPremium')
              }}
            </Badge>
            <span class="text-xs text-primary-warm-gray">
              {{ card.note[locale] || card.note.en }}
            </span>
          </div>

          <IconButton
            v-if="showCardLink"
            as="a"
            :href="card.href"
            target="_blank"
            rel="noopener"
            :aria-label="card.name[locale] || card.name.en"
            size="sm"
            :class="
              cn(
                'ml-auto rounded-xl text-primary-comfy-ink hover:text-primary-comfy-ink',
                gallery.ctaVariant === 'accent'
                  ? 'bg-primary-comfy-yellow hover:opacity-90'
                  : 'bg-primary-warm-gray hover:bg-primary-comfy-yellow'
              )
            "
          >
            <ChevronRight class="size-5" :stroke-width="2" />
          </IconButton>
        </div>

        <p
          v-if="!overlayCaptions"
          class="mt-3 text-sm font-light text-primary-comfy-canvas"
        >
          {{ card.description[locale] || card.description.en }}
        </p>

        <div
          v-if="card.prompt"
          data-testid="gallery-card-prompt"
          class="mt-4 flex items-end gap-2 rounded-2xl border border-transparency-white-t8 p-6"
        >
          <p
            class="line-clamp-5 flex-1 text-sm/relaxed font-light whitespace-pre-line text-primary-warm-gray"
          >
            {{ card.prompt[locale] || card.prompt.en }}
          </p>
          <CopyTextButton
            class="-mr-2 -mb-2"
            :value="card.prompt[locale] || card.prompt.en"
            :label="t('modelLaunch.copyPrompt')"
            :copied-label="t('ui.copied')"
          />
        </div>
      </article>
    </div>

    <Dialog
      :open="expandedImage !== null"
      @update:open="(open) => !open && (expandedImage = null)"
    >
      <DialogContent
        v-if="expandedImage"
        :close-label="t('gallery.detail.close')"
        class="max-h-[95vh] w-[calc(100%-1rem)] max-w-none overflow-visible border-0 bg-transparent p-0 sm:max-w-none sm:p-0 lg:p-0"
      >
        <DialogTitle class="sr-only">
          {{ expandedImage.name[locale] || expandedImage.name.en }}
        </DialogTitle>
        <img
          :src="expandedImage.src"
          :alt="expandedImage.name[locale] || expandedImage.name.en"
          class="max-h-[92vh] w-full rounded-3xl object-contain"
        />
      </DialogContent>
    </Dialog>

    <div
      v-if="hasMobileOverflow && !mobileExpanded"
      class="mt-10 flex justify-center md:hidden"
    >
      <BrandButton
        type="button"
        variant="outline"
        size="lg"
        class="uppercase"
        @click="mobileExpanded = true"
      >
        {{ t('modelLaunch.loadMore') }}
      </BrandButton>
    </div>
  </section>
</template>
