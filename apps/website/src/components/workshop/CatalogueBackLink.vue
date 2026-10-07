<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { lastList } from '@/lib/workshop/shelf-memory'

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
const { t } = translationsFor(locale)

const catalogueHref = catalogue ?? getRoutes(locale).workshop
const href = ref(catalogueHref)
const category = ref<string>()

// Most visitors reach a model from a list, and the way back they want is that
// list as they left it, not the whole catalogue. Opened in a new tab, or
// reached from a link somebody shared, there is no list to return to and the
// catalogue answers.
onMounted(() => {
  const list = lastList(location.pathname)
  if (!list) return
  href.value = list.href
  category.value = list.label
})
</script>

<template>
  <a
    :href
    class="-ml-1 inline-flex min-w-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="model-back"
  >
    <ChevronLeft class="size-4 shrink-0" aria-hidden="true" />
    <span class="truncate">{{
      category
        ? t('workshop.model.backTo', { category })
        : (fallback ?? t('workshop.model.back'))
    }}</span>
  </a>
</template>
