<script setup lang="ts">
import type { ModelFamily } from '@/config/model-family'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { CARD_GRID_BESIDE_NAV } from '@/lib/workshop/card-layout'
import { canCompare, MAX_COMPARED } from '@/lib/workshop/explorer/compare'
import CompareToggle from '@/components/workshop/explorer/compare/CompareToggle.vue'
import WorkshopModelCard from '@/components/workshop/WorkshopModelCard.vue'

const {
  families,
  compared = [],
  locale = 'en'
} = defineProps<{
  families: readonly ModelFamily[]
  compared?: readonly string[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{
  open: [model: WorkshopModel, event: MouseEvent]
  compare: [slug: string]
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
      <li v-for="family in families" :key="family.key" class="relative">
        <WorkshopModelCard
          :model="family.latest"
          :locale
          @click="$emit('open', family.latest, $event)"
        />
        <CompareToggle
          v-if="canCompare(family.latest)"
          :model-value="compared.includes(family.latest.slug)"
          :name="family.latest.name"
          :disabled="
            compared.length >= MAX_COMPARED &&
            !compared.includes(family.latest.slug)
          "
          :locale
          class="absolute top-4 right-4 z-20"
          @update:model-value="$emit('compare', family.latest.slug)"
        />
      </li>
    </ul>
  </div>
</template>
