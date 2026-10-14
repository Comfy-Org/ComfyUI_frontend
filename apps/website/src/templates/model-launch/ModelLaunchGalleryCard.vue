<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchGallery, ModelLaunchGalleryCard } from './types'

import Badge from '@/components/ui/badge/Badge.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import { translationsFor } from '@/i18n/translations'
import ModelLaunchGalleryCardMedia from './ModelLaunchGalleryCardMedia.vue'

const {
  card,
  locale = 'en',
  ctaVariant,
  cardMeta,
  captionPlacement,
  loadVideo = true
} = defineProps<{
  card: ModelLaunchGalleryCard
  locale?: Locale
  ctaVariant?: ModelLaunchGallery['ctaVariant']
  cardMeta?: ModelLaunchGallery['cardMeta']
  captionPlacement?: ModelLaunchGallery['captionPlacement']
  loadVideo?: boolean
}>()
const emit = defineEmits<{ expand: [] }>()
const { t } = translationsFor(locale)

const showMeta = cardMeta !== 'none'
const showLink = ctaVariant !== 'none'
const overlayCaption = captionPlacement === 'overlay'
const isFree = card.tier === 'free'
const tierVariant = isFree ? 'accent' : 'callout'
const tierLabel = isFree
  ? t('modelLaunch.tagFree')
  : t('modelLaunch.tagPremium')
const name = card.name[locale] || card.name.en
const note = card.note[locale] || card.note.en
const description = card.description[locale] || card.description.en
const prompt = card.prompt && (card.prompt[locale] || card.prompt.en)
const linkClass = cn(
  'rounded-xl text-primary-comfy-ink hover:text-primary-comfy-ink',
  !showMeta && 'ml-auto',
  ctaVariant === 'accent'
    ? 'bg-primary-comfy-yellow hover:opacity-90'
    : 'bg-primary-warm-gray hover:bg-primary-comfy-yellow'
)
</script>

<template>
  <article>
    <ModelLaunchGalleryCardMedia
      :card
      :locale
      :overlay-caption="overlayCaption"
      :load-video="loadVideo"
      @expand="emit('expand')"
    />

    <div
      v-if="showMeta || showLink"
      class="mt-5 flex items-center justify-between gap-3"
    >
      <div v-if="showMeta" class="flex items-center gap-3">
        <Badge :variant="tierVariant">{{ tierLabel }}</Badge>
        <span class="text-xs text-primary-warm-gray">{{ note }}</span>
      </div>

      <IconButton
        v-if="showLink"
        as="a"
        :href="card.href"
        target="_blank"
        rel="noopener"
        :aria-label="name"
        size="sm"
        :class="linkClass"
      >
        <ChevronRight class="size-5" :stroke-width="2" />
      </IconButton>
    </div>

    <p
      v-if="!overlayCaption"
      class="mt-3 text-sm font-light text-primary-comfy-canvas"
    >
      {{ description }}
    </p>

    <div
      v-if="prompt"
      data-testid="gallery-card-prompt"
      class="mt-4 flex items-end gap-2 rounded-2xl border border-transparency-white-t8 p-6"
    >
      <p
        class="line-clamp-5 flex-1 text-sm/relaxed font-light whitespace-pre-line text-primary-warm-gray"
      >
        {{ prompt }}
      </p>
      <CopyTextButton
        class="-mr-2 -mb-2"
        :value="prompt"
        :label="t('modelLaunch.copyPrompt')"
        :copied-label="t('ui.copied')"
      />
    </div>
  </article>
</template>
