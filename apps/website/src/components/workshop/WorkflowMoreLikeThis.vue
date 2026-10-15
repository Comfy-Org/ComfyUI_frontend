<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'

import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { fetchModelsCatalogue } from '@/config/models-catalogue-data'
import { t } from '@/i18n/translations'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import { relatedWorkflows } from '@/lib/workshop/related-workflows'
import { isWorkshopModelShown } from '@/scripts/workshop-model-flags'
import CardRow from './CardRow.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { model } = defineProps<{ model: WorkshopModel }>()

const catalogue = shallowRef<readonly WorkshopModel[]>([])
onMounted(async () => {
  try {
    catalogue.value = await fetchModelsCatalogue()
  } catch {
    catalogue.value = []
  }
})

const related = computed<readonly WorkflowWorkshopModel[]>(() =>
  relatedWorkflows(
    model,
    catalogue.value.filter((entry) => isWorkshopModelShown(entry))
  )
)
</script>

<template>
  <section
    v-if="related.length"
    aria-labelledby="workflow-more-like-this"
    data-testid="workflow-more-like-this"
  >
    <CardRow>
      <template #heading>
        <h2
          id="workflow-more-like-this"
          class="text-xl font-medium text-primary-warm-white"
        >
          {{ t('hubPages.workflow.moreLikeThis') }}
        </h2>
      </template>
      <li v-for="entry in related" :key="entry.slug" :class="SHELF_CARD">
        <WorkshopModelCard :model="entry" />
      </li>
    </CardRow>
  </section>
</template>
