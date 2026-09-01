<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ModalityFilter, WorkshopModel } from '../../config/workshop'
import { modalityOf } from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModel
  locale?: Locale
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
  '3d': 'from-primary-comfy-orange/70 to-primary-comfy-ink-light',
  text: 'from-secondary-cool-gray to-primary-comfy-ink-light',
  other: 'from-primary-comfy-ink-light to-primary-comfy-ink'
}
</script>

<template>
  <a
    :href="model.href"
    class="group bg-transparency-white-t4 flex h-full flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 transition-colors hover:border-transparency-white-t20"
    data-testid="workshop-model-card"
  >
    <div
      :class="
        cn(
          'relative grid aspect-4/3 place-items-center bg-linear-to-br',
          modalityTone[modality]
        )
      "
    >
      <span
        class="font-formula text-6xl font-bold text-primary-warm-white/20 select-none"
        aria-hidden="true"
      >
        {{ model.name[0] }}
      </span>
      <span
        class="absolute top-3 left-3 rounded-full bg-primary-comfy-ink/70 px-2 py-0.5 text-[10px] font-bold tracking-widest text-primary-warm-white uppercase"
      >
        {{ t(modalityLabelKey[modality], locale) }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-1 p-4">
      <h3 class="text-base/tight font-semibold text-primary-comfy-canvas">
        {{ model.name }}
      </h3>
      <p class="text-sm text-primary-warm-gray">
        {{ model.provider ?? t('workshop.card.partnerNode', locale) }}
      </p>

      <div
        class="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-primary-comfy-canvas/70"
      >
        <span v-if="model.creditsPerRun !== undefined">
          <span class="text-primary-comfy-yellow font-bold">
            {{ model.creditsPerRun }}
          </span>
          {{ t('workshop.card.creditsPerRun', locale) }}
        </span>
        <span v-else>{{ t('workshop.card.priceOnPage', locale) }}</span>
        <span>
          {{ model.workflowCount }} {{ t('workshop.card.workflows', locale) }}
        </span>
      </div>

      <span
        class="text-primary-comfy-yellow mt-3 inline-flex items-center gap-1 text-xs font-bold tracking-wider uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {{ t('workshop.card.tryCta', locale) }}
        <ArrowRight class="size-3.5" aria-hidden="true" />
      </span>
    </div>
  </a>
</template>
