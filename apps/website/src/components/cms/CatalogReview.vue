<script setup lang="ts">
import { Eye, Pencil } from '@lucide/vue'

import FieldChange from '@/components/cms/FieldChange.vue'
import ReadinessChecklist from '@/components/cms/ReadinessChecklist.vue'
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
  <div class="flex flex-wrap gap-2">
    <AdminButton
      v-if="item.change !== 'removed'"
      :href="pagePreview"
      target="_blank"
      rel="noopener"
      :icon="Eye"
    >
      {{ t('cmsAdmin.review.seeOnPage') }}
    </AdminButton>
    <AdminButton :href="`/admin/edit/${item.id}`" :icon="Pencil">
      {{ t('cmsAdmin.content.edit') }}
    </AdminButton>
  </div>
  <ReadinessChecklist
    v-if="item.change !== 'removed'"
    :gaps="item.gaps"
    :kind="item.kind"
    :locale
  />
  <QueueThumb
    v-if="item.change === 'new' && item.thumbnail"
    :src="item.thumbnail"
    :kind="item.kind"
    class="w-full"
  />
  <section class="grid gap-2">
    <h3
      class="text-xs font-medium tracking-[0.06em] text-admin-muted uppercase"
    >
      {{
        item.change === 'new'
          ? t('cmsAdmin.review.newTitle')
          : t('cmsAdmin.review.changesTitle')
      }}
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
