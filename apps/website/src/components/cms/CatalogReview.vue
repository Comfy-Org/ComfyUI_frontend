<script setup lang="ts">
import { Eye } from '@lucide/vue'

import FieldChange from '@/components/cms/FieldChange.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogQueueItem } from '@/lib/cms/queue'

const { item, locale = 'en' } = defineProps<{
  item: CatalogQueueItem
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const pagePreview = `${item.slug.replace(/\/?$/, '/')}?preview=DRAFT`
</script>

<template>
  <QueueThumb v-if="item.thumbnail" :src="item.thumbnail" class="w-full" />
  <AdminButton
    v-if="item.change !== 'removed'"
    :href="pagePreview"
    target="_blank"
    rel="noopener"
    class="w-fit"
    :icon="Eye"
  >
    {{ t('cmsAdmin.review.seeOnPage') }}
  </AdminButton>
  <section class="grid gap-2">
    <h3
      class="text-xs font-medium tracking-[0.06em] text-admin-muted uppercase"
    >
      {{ t('cmsAdmin.review.changesTitle') }}
    </h3>
    <ul class="grid gap-2">
      <FieldChange
        v-for="group in item.fields"
        :key="group.field"
        :group
        :show-before="item.change !== 'new'"
        :show-after="item.change !== 'removed'"
        :locale
      />
    </ul>
  </section>
</template>
