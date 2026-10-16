<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import ReviewMediaUses from './ReviewMediaUses.vue'
import CatalogChangeMedia from './CatalogChangeMedia.vue'
import type { ReviewItem } from '@/lib/cms/staging-review'
import { fieldDifferences, itemTitle } from '@/lib/cms/staging-review'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  item,
  draftRev,
  locale = 'en'
} = defineProps<{
  item: ReviewItem
  draftRev?: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const differences = computed(() => fieldDifferences(item))
const href = computed(() => {
  const path = `/admin/content/${item.content.uid}/view`
  return draftRev && Number.isSafeInteger(draftRev) && draftRev > 0
    ? `${path}?rev=${draftRev}&version=${item.content.revision_uid}`
    : path
})
</script>

<template>
  <p class="text-sm text-admin-muted">{{ item.summary }}</p>
  <CatalogChangeMedia
    v-if="item.presentation?.preview"
    :key="item.presentation.preview.src"
    :preview="item.presentation.preview"
    :label="t('cccChangeDetails.previewFor', { title: itemTitle(item) })"
    :unavailable="t('cccChangeDetails.unavailable')"
    expanded
  />
  <a :href class="inline-flex w-fit items-center gap-1 text-sm underline">
    {{ t('cccChangeDetails.openRecord') }}
    <ArrowUpRight class="size-4" aria-hidden="true" />
  </a>
  <code class="text-xs break-all text-admin-muted">{{ item.content.uid }}</code>
  <ReviewMediaUses
    v-if="item.content.type === 'media'"
    :presentation="item.presentation"
    :locale
  />
  <section class="grid gap-2">
    <h3
      class="text-xs font-medium tracking-[0.06em] text-admin-muted uppercase"
    >
      {{ t('cmsAdmin.review.changesTitle') }}
    </h3>
    <p class="text-xs text-admin-muted">{{ t('cccStaging.diffLimit') }}</p>
    <ul class="grid gap-2">
      <li
        v-for="difference in differences"
        :key="difference.path"
        class="overflow-hidden rounded-lg border border-admin-line text-xs"
      >
        <p
          class="border-b border-admin-line bg-admin-page px-3 py-1.5 text-admin-muted"
        >
          <code class="break-all">{{ difference.path }}</code>
        </p>
        <pre
          v-if="difference.before !== undefined"
          class="bg-admin-danger/6 px-3 py-2 break-all whitespace-pre-wrap text-admin-muted"
          >{{ difference.before }}</pre>
        <pre
          v-if="difference.after !== undefined"
          class="bg-admin-success/6 px-3 py-2 break-all whitespace-pre-wrap"
          >{{ difference.after }}</pre>
      </li>
    </ul>
  </section>
</template>
