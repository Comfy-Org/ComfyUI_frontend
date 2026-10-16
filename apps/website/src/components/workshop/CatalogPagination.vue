<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type {
  CatalogListPage,
  CatalogListSection
} from '@/lib/cms/catalog-list'

const {
  page,
  section,
  initialSearch,
  locale = 'en'
} = defineProps<{
  page: CatalogListPage
  section: CatalogListSection
  initialSearch?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const start = computed(() =>
  page.total ? (page.page - 1) * page.pageSize + 1 : 0
)
const end = computed(() => Math.min(page.page * page.pageSize, page.total))
function href(value: number) {
  const params = new URLSearchParams(initialSearch)
  params.set('p', String(value))
  return `${locale === 'zh-CN' ? '/zh-CN' : ''}/hub/${section}/?${params}`
}
const linkClass =
  'rounded-xl border border-transparency-white-t8 px-5 py-3 text-primary-comfy-canvas hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <nav
    class="mt-8 flex flex-wrap items-center justify-center gap-4"
    :aria-label="t('cccCatalogPage.navigation')"
    data-testid="catalog-pagination"
  >
    <a
      v-if="page.hasPrevious"
      :href="href(page.page - 1)"
      :class="linkClass"
      data-testid="catalog-previous"
      data-astro-prefetch="false"
      >{{ t('cccCatalogPage.previous') }}</a
    >
    <span class="text-sm text-primary-warm-gray tabular-nums">{{
      t('cccCatalogPage.range', { start, end, total: page.total })
    }}</span>
    <a
      v-if="page.hasNext"
      :href="href(page.page + 1)"
      :class="linkClass"
      data-testid="catalog-next"
      data-astro-prefetch="false"
      >{{ t('cccCatalogPage.next') }}</a
    >
  </nav>
</template>
