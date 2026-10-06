<script setup lang="ts">
import type { ModelFamily } from '@/config/model-family'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { CARD_GRID } from '@/lib/workshop/card-layout'
import { canCompare, MAX_COMPARED } from '@/lib/workshop/explorer/compare'
import type { OpenWeightModel } from '@/lib/workshop/explorer/open-weight-models'
import CompareToggle from '@/components/workshop/explorer/compare/CompareToggle.vue'
import WorkshopModelCard from '@/components/workshop/WorkshopModelCard.vue'
import OpenWeightModelCard from '@/components/workshop/explorer/OpenWeightModelCard.vue'

const {
  families,
  openWeight,
  compared = [],
  locale = 'en'
} = defineProps<{
  families: readonly ModelFamily[]
  openWeight: readonly OpenWeightModel[]
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
      :class="CARD_GRID"
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
          v-if="canCompare(family.latest)"
          :model-value="compared.includes(family.latest.slug)"
          :name="family.latest.name"
          :revealed="compared.length > 0"
          :disabled="
            compared.length >= MAX_COMPARED &&
            !compared.includes(family.latest.slug)
          "
          :locale
          class="absolute top-4 right-4 z-20"
          @update:model-value="$emit('compare', family.latest.slug)"
        />
      </li>
      <li v-for="model in openWeight" :key="model.slug">
        <OpenWeightModelCard :model :locale />
      </li>
    </ul>
  </div>
</template>
