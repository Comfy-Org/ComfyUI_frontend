<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { lastShelf } from '../../lib/workshop/shelf-memory'
import { shelfLabelKey } from '../../lib/workshop/shelf-label'

const {
  catalogue,
  fallbackKey = 'workshop.model.back',
  locale = 'en'
} = defineProps<{
  /** The listing this page belongs to. Defaults to the live catalogue. */
  catalogue?: string
  fallbackKey?: TranslationKey
  locale?: Locale
}>()

const routes = getRoutes(locale)
const catalogueHref = catalogue ?? routes.workshop
const href = ref(catalogueHref)
const category = ref<string>()

// Most visitors reach a model from a shelf, and the way back they want is that
// shelf, not the whole catalogue. Opened in a new tab, or reached from a link
// somebody shared, there is no shelf to return to and the catalogue answers.
onMounted(() => {
  const shelf = lastShelf(location.pathname)
  const labelKey = shelf ? shelfLabelKey(shelf) : undefined
  if (!shelf || !labelKey) return
  href.value = `${catalogueHref}?useCase=${encodeURIComponent(shelf)}`
  category.value = t(labelKey, locale)
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
        : t(fallbackKey, locale)
    }}
  </a>
</template>
