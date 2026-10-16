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
const emit = defineEmits<{ navigate: [search: string] }>()
function navigate(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  if (!(event.currentTarget instanceof HTMLAnchorElement)) return
  event.preventDefault()
  emit('navigate', new URL(event.currentTarget.href).search.slice(1))
}
const count = computed(() =>
  page.mode === 'cursor'
    ? (page.count ?? 0)
    : Math.max(
        0,
        Math.min(
          page.pageSize,
          (page.total ?? 0) - (page.page - 1) * page.pageSize
        )
      )
)
const start = computed(() =>
  count.value ? (page.page - 1) * page.pageSize + 1 : 0
)
const end = computed(() => (count.value ? start.value + count.value - 1 : 0))
function href(value: number, cursor?: string) {
  const params = new URLSearchParams(initialSearch)
  params.set('p', String(value))
  if (page.mode === 'cursor') {
    params.delete('cursor')
    if (cursor) params.set('cursor', cursor)
  }
  return `${locale === 'zh-CN' ? '/zh-CN' : ''}/hub/${section}/?${params}`
}
const linkClass =
  'rounded-xl border border-transparency-white-t8 px-5 py-3 text-primary-comfy-canvas hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <p
    v-if="page.reset"
    role="status"
    class="mt-6 text-center text-sm text-primary-warm-gray"
  >
    {{ t('cccCatalogPage.reset') }}
  </p>
  <nav
    class="mt-8 flex flex-wrap items-center justify-center gap-4"
    :aria-label="t('cccCatalogPage.navigation')"
    data-testid="catalog-pagination"
  >
    <a
      v-if="page.hasPrevious"
      :href="href(page.page - 1, page.previousCursor)"
      :class="linkClass"
      data-testid="catalog-previous"
      data-astro-prefetch="false"
      @click="navigate"
      >{{ t('cccCatalogPage.previous') }}</a
    >
    <span class="text-sm text-primary-warm-gray tabular-nums">{{
      page.total === undefined
        ? t('cccCatalogPage.rangeWithoutTotal', { start, end })
        : t('cccCatalogPage.range', { start, end, total: page.total })
    }}</span>
    <a
      v-if="page.hasNext"
      :href="href(page.page + 1, page.nextCursor)"
      :class="linkClass"
      data-testid="catalog-next"
      data-astro-prefetch="false"
      @click="navigate"
      >{{ t('cccCatalogPage.next') }}</a
    >
  </nav>
</template>
