<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ModalityFilter, WorkshopModel } from '../../config/workshop'
import { modalityOf } from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CardArrow from '../common/CardArrow.vue'

const {
  model,
  locale = 'en',
  showStatus = false
} = defineProps<{
  model: WorkshopModel
  locale?: Locale
  showStatus?: boolean
}>()

const modality = computed(() => modalityOf(model))

const modalityLabelKey: Record<
  Exclude<ModalityFilter, 'all'>,
  TranslationKey
> = {
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}

const modalityTone: Record<Exclude<ModalityFilter, 'all'>, string> = {
  image: 'from-primary-comfy-plum to-secondary-deep-plum',
  video: 'from-secondary-mauve to-primary-comfy-plum',
  audio: 'from-illustration-forest to-primary-comfy-ink-light',
  '3d': 'from-primary-comfy-yellow/70 to-primary-comfy-ink-light',
  text: 'from-secondary-cool-gray to-primary-comfy-ink-light',
  other: 'from-primary-comfy-ink-light to-primary-comfy-ink'
}

const price = computed(() => {
  if (model.priceUsdFrom !== undefined) {
    return `${t('workshop.card.from', locale)} ${new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD'
    }).format(model.priceUsdFrom)}`
  }
  if (model.creditsPerRun !== undefined) {
    return `${t('workshop.card.from', locale)} ${model.creditsPerRun} ${t('nav.credits', locale)}`
  }
  return undefined
})

const pillClass =
  'inline-flex h-8 items-center rounded-2xl bg-white/20 px-3 text-[11px] font-bold tracking-wider text-white uppercase backdrop-blur-sm'
</script>

<template>
  <a
    :href="model.href"
    class="group bg-primary-comfy-ink-light relative block aspect-4/5 overflow-hidden rounded-3xl"
    data-testid="workshop-model-card"
  >
    <img
      v-if="model.thumbnailUrl"
      :src="model.thumbnailUrl"
      :alt="model.name"
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      decoding="async"
    />
    <div
      v-else
      :class="
        cn(
          'grid size-full place-items-center bg-linear-to-br',
          modalityTone[modality]
        )
      "
    >
      <span
        class="font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
        aria-hidden="true"
      >
        {{ model.name[0] }}
      </span>
    </div>

    <div
      class="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-black/35"
    />

    <div
      class="absolute inset-x-4 top-4 flex items-start justify-between gap-2"
    >
      <div class="flex flex-wrap gap-2">
        <span :class="pillClass">
          {{ t(modalityLabelKey[modality], locale) }}
        </span>
        <span
          v-if="showStatus && model.status"
          :class="cn(pillClass, 'bg-primary-comfy-yellow/80')"
        >
          {{
            model.status === 'deprecated'
              ? t('workshop.model.deprecated', locale)
              : t('workshop.model.degraded', locale)
          }}
        </span>
      </div>
      <span
        v-if="price"
        :class="cn(pillClass, 'tracking-normal normal-case tabular-nums')"
        data-testid="workshop-card-price"
      >
        {{ price }}
      </span>
    </div>

    <div class="absolute right-16 bottom-5 left-5">
      <p
        class="text-2xl/tight font-light text-primary-warm-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
      >
        {{ model.name }}
      </p>
      <p class="mt-1 text-sm text-primary-comfy-canvas/80">
        {{ model.provider ?? t('workshop.card.partnerNode', locale) }}
        <span class="text-primary-comfy-canvas/50">
          · {{ model.workflowCount }}
          {{ t('workshop.card.workflows', locale) }}
        </span>
      </p>
    </div>

    <CardArrow hover="group" class="absolute right-4 bottom-4" />
  </a>
</template>
