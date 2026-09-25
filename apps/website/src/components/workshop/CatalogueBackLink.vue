<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import { catalogSearch } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { lastShelf } from '../../lib/workshop/shelf-memory'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const {
  catalogue,
  fallback,
  locale = 'en'
} = defineProps<{
  /** The listing this page belongs to. Defaults to the live catalogue. */
  catalogue?: string
  /** What to call that listing when no shelf is remembered. */
  fallback?: string
  locale?: Locale
}>()

const catalogueHref = catalogue ?? getRoutes(locale).workshop
const href = ref(catalogueHref)
const category = ref<string>()

// Most visitors reach a model from a shelf, and the way back they want is that
// shelf, not the whole catalogue. Opened in a new tab, or reached from a link
// somebody shared, there is no shelf to return to and the catalogue answers.
onMounted(() => {
  const shelf = lastShelf(location.pathname)
  if (!shelf || shelf === 'all') return
  href.value = `${catalogueHref}${catalogSearch({ useCase: shelf })}`
  category.value = t(useCaseLabelKey[shelf], locale)
})
</script>

<template>
  <a
    :href
    class="-ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="model-back"
  >
    <ChevronLeft class="size-4" aria-hidden="true" />
    {{
      category
        ? t('workshop.model.backTo', locale).replace('{category}', category)
        : (fallback ?? t('workshop.model.back', locale))
    }}
  </a>
</template>
