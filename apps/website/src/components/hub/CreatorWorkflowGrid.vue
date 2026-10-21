<script setup lang="ts">
import { ref } from 'vue'

import WorkshopModelCard from '@/components/workshop/WorkshopModelCard.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { fetchCataloguePage } from '@/lib/cms/catalogue-page-client'
import { CARD_GRID } from '@/lib/workshop/card-layout'
import LoadMoreButton from './LoadMoreButton.vue'

const {
  initialModels,
  nextCursor: initialCursor,
  author,
  locale = 'en'
} = defineProps<{
  initialModels: readonly WorkshopModel[]
  nextCursor?: string
  author: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const models = ref<readonly WorkshopModel[]>(initialModels)
const nextCursor = ref(initialCursor)
const page = ref(1)
const loading = ref(false)

async function loadMore() {
  if (loading.value || !nextCursor.value) return
  loading.value = true
  try {
    const url = new URL('/models/catalogue.json', window.location.origin)
    url.search = new URLSearchParams({
      section: 'workflows',
      format: 'page',
      locale,
      author,
      cursor: nextCursor.value,
      p: String(page.value + 1)
    }).toString()
    const result = await fetchCataloguePage(
      url,
      AbortSignal.timeout(10_000)
    ).catch(() => undefined)
    if (!result) return
    const shown = new Set(models.value.map(({ href }) => href))
    models.value = [
      ...models.value,
      ...result.models.filter(({ href }) => !shown.has(href))
    ]
    nextCursor.value = result.pages.workflows.nextCursor
    page.value += 1
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <div :class="CARD_GRID" data-testid="hub-grid">
      <WorkshopModelCard
        v-for="model in models"
        :key="model.href"
        :model
        :locale
        under-heading
      />
    </div>
    <LoadMoreButton
      v-if="nextCursor"
      :label="t('workshop.hub.loadMore')"
      :disabled="loading"
      @click="loadMore"
    />
  </div>
</template>
