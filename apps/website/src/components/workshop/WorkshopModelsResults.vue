<script setup lang="ts">
import type { ModelFamily } from '@/config/model-family'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { CARD_GRID } from '@/lib/workshop/card-layout'
import type { OpenWeightModel } from '@/lib/workshop/explorer/open-weight-models'
import WorkshopModelCard from '@/components/workshop/WorkshopModelCard.vue'
import OpenWeightModelCard from '@/components/workshop/explorer/OpenWeightModelCard.vue'

const {
  families,
  openWeight,
  locale = 'en'
} = defineProps<{
  families: readonly ModelFamily[]
  openWeight: readonly OpenWeightModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ open: [model: WorkshopModel, event: MouseEvent] }>()
</script>

<template>
  <div>
    <h2 id="workshop-models-heading" class="sr-only">
      {{ t('workshop.models.heading') }}
    </h2>
    <ul
      :class="CARD_GRID"
      aria-labelledby="workshop-models-heading"
      data-testid="workshop-models-grid"
    >
      <li v-for="family in families" :key="family.key">
        <WorkshopModelCard
          :model="family.latest"
          :locale
          @click="$emit('open', family.latest, $event)"
        />
      </li>
      <li v-for="model in openWeight" :key="model.slug">
        <OpenWeightModelCard :model :locale />
      </li>
    </ul>
  </div>
</template>
