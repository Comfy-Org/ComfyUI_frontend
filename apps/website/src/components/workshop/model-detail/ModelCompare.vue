<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CompareView from '@/components/workshop/explorer/compare/CompareView.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { canCompare, comparedSearch } from '@/lib/workshop/explorer/compare'

const {
  model,
  candidates,
  locale = 'en'
} = defineProps<{
  model: WorkshopModel
  /** The other models to offer, already chosen and ordered. */
  candidates: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const shown = computed(() => canCompare(model) && candidates.length > 0)
const chosenSlug = ref(candidates[0]?.slug)
const chosen = computed(
  () =>
    candidates.find((other) => other.slug === chosenSlug.value) ?? candidates[0]
)
const pair = computed(() => (chosen.value ? [model, chosen.value] : []))
const fullHref = computed(
  () =>
    `${getRoutes(locale).workshop}${comparedSearch(
      '',
      pair.value.map((entry) => entry.slug)
    )}`
)
</script>

<template>
  <section
    v-if="shown"
    aria-labelledby="model-compare-heading"
    class="mt-24 border-t border-transparency-white-t8 pt-12"
    data-testid="model-compare"
  >
    <div class="mb-6 flex flex-wrap items-baseline justify-between gap-4">
      <h2
        id="model-compare-heading"
        class="text-2xl font-bold text-primary-comfy-canvas"
      >
        {{ t('workshop.explorer.compare.howItCompares') }}
      </h2>
      <Button
        :href="fullHref"
        variant="link"
        :append-icon="ArrowRight"
        data-testid="model-compare-full"
      >
        {{ t('workshop.explorer.compare.openFull') }}
      </Button>
    </div>
    <div
      role="group"
      :aria-label="t('workshop.explorer.compare.compareWith')"
      class="mb-8 flex flex-wrap items-center gap-2"
    >
      <span class="mr-2 text-sm text-primary-warm-gray" aria-hidden="true">
        {{ t('workshop.explorer.compare.compareWith') }}
      </span>
      <button
        v-for="other in candidates"
        :key="other.slug"
        type="button"
        :aria-pressed="other.slug === chosen?.slug"
        :class="
          cn(
            'h-8 cursor-pointer rounded-full px-3 text-xs font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
            other.slug === chosen?.slug
              ? 'bg-transparency-white-t8 text-primary-warm-white'
              : 'ring-1 ring-transparency-white-t8'
          )
        "
        data-testid="model-compare-chip"
        @click="chosenSlug = other.slug"
      >
        {{ other.name }}
      </button>
    </div>
    <CompareView :models="pair" :locale />
  </section>
</template>
