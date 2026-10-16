<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ref, shallowRef, useTemplateRef, onScopeDispose } from 'vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { relatedModels } from '@/config/workshop-related'
import { fetchCataloguePage } from '@/lib/cms/catalogue-page-client'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModel
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const root = useTemplateRef<HTMLElement>('root')
const cards = shallowRef<WorkshopModel[]>([])
const loading = ref(true)
const request = new AbortController()
let started = false
useIntersectionObserver(
  root,
  ([entry]) => {
    if (!entry?.isIntersecting || started) return
    started = true
    void load()
  },
  { rootMargin: '200px' }
)
async function load() {
  try {
    const url = new URL('/models/catalogue.json', location.origin)
    url.search = new URLSearchParams({
      format: 'page',
      section: 'models',
      locale
    }).toString()
    const result = await fetchCataloguePage(
      url,
      AbortSignal.any([request.signal, AbortSignal.timeout(10000)])
    )
    cards.value = relatedModels(model, result.models).slice(0, 4)
  } catch {
    // An optional related shelf must not fail or delay the primary record.
    cards.value = []
  } finally {
    loading.value = false
  }
}
onScopeDispose(() => request.abort())
</script>

<template>
  <section
    ref="root"
    class="mt-24 border-t border-transparency-white-t8 pt-12"
    data-testid="related-models"
    :aria-busy="loading"
  >
    <h2
      v-if="loading || cards.length"
      class="mb-6 text-2xl font-bold text-primary-comfy-canvas"
    >
      {{ t('workshop.model.related') }}
    </h2>
    <ul
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <li v-for="other in cards" :key="other.slug">
        <WorkshopModelCard :model="other" />
      </li>
    </ul>
  </section>
</template>
