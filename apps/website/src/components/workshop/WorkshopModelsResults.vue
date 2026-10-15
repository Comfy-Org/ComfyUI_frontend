<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { ModelFamily } from '@/config/model-family'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { CARD_GRID_BESIDE_NAV } from '@/lib/workshop/card-layout'
import { canCompare, MAX_COMPARED } from '@/lib/workshop/explorer/compare'
import CompareToggle from '@/components/workshop/explorer/compare/CompareToggle.vue'
import WorkshopModelCard from '@/components/workshop/WorkshopModelCard.vue'
import CatalogueShowMore from './CatalogueShowMore.vue'

const {
  families,
  compared = [],
  comparable = false,
  limit,
  total,
  locale = 'en'
} = defineProps<{
  families: readonly ModelFamily[]
  compared?: readonly string[]
  /** Whether each card offers its Compare toggle. */
  comparable?: boolean
  /** How many cards are shown out of `total`; Show more appears below the rest. */
  limit: number
  total: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{
  open: [model: WorkshopModel, event: MouseEvent]
  compare: [slug: string]
  more: []
}>()
</script>

<template>
  <div>
    <h2 id="workshop-models-heading" class="sr-only">
      {{ t('workshop.models.heading') }}
    </h2>
    <ul
      :class="CARD_GRID_BESIDE_NAV"
      aria-labelledby="workshop-models-heading"
      data-testid="workshop-models-grid"
    >
      <li
        v-for="family in families"
        :key="family.key"
        class="group/compare relative"
      >
        <WorkshopModelCard
          :model="family.latest"
          :locale
          @click="$emit('open', family.latest, $event)"
        />
        <CompareToggle
          v-if="comparable && canCompare(family.latest)"
          :model-value="compared.includes(family.latest.slug)"
          :name="family.latest.name"
          :disabled="
            compared.length >= MAX_COMPARED &&
            !compared.includes(family.latest.slug)
          "
          :locale
          :class="
            cn(
              'absolute top-6 left-6 z-20 transition-opacity',
              !compared.length &&
                'opacity-0 group-focus-within/compare:opacity-100 group-hover/compare:opacity-100 pointer-coarse:opacity-100'
            )
          "
          @update:model-value="$emit('compare', family.latest.slug)"
        />
      </li>
    </ul>
    <CatalogueShowMore
      v-if="limit < total"
      :shown="limit"
      :total
      :locale
      @more="$emit('more')"
    />
  </div>
</template>
