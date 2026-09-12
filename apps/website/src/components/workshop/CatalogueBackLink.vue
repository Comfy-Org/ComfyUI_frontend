<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import { catalogSearch } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { lastShelf } from '../../lib/workshop/shelf-memory'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
const href = ref(routes.workshop)
const category = ref<string>()

// Most visitors reach a model from a shelf, and the way back they want is that
// shelf, not the whole catalogue. Opened in a new tab, or reached from a link
// somebody shared, there is no shelf to return to and the catalogue answers.
onMounted(() => {
  const shelf = lastShelf()
  if (!shelf || shelf === 'all') return
  href.value = `${routes.workshop}${catalogSearch({ useCase: shelf })}`
  category.value = t(useCaseLabelKey[shelf], locale)
})
</script>

<template>
  <a
    :href
    class="hover:text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3"
    data-testid="model-back"
  >
    <ChevronLeft class="size-4" aria-hidden="true" />
    {{
      category
        ? t('workshop.model.backTo', locale).replace('{category}', category)
        : t('workshop.model.back', locale)
    }}
  </a>
</template>
