<script setup lang="ts">
import { ExternalLink, Pencil } from '@lucide/vue'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture, pageOf } from '@/lib/cms/format'
import type { ContentRow } from '@/lib/cms/queue'

const { row, locale = 'en' } = defineProps<{
  row: ContentRow
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const appears = isFuture(row.visibleFrom)
  ? t('cmsAdmin.content.appears', {
      date: formatUtc(row.visibleFrom ?? '', locale)
    })
  : ''
const meta = [t(`cmsAdmin.kind.${row.kind}`), row.provider]
  .filter(Boolean)
  .join(' · ')
</script>

<template>
  <li
    class="grid min-h-14 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 border-b border-admin-hover px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-admin-hover md:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
  >
    <QueueThumb :src="row.thumbnail" class="w-14" />
    <div class="grid min-w-0 gap-1">
      <span class="truncate">{{ row.title }}</span>
      <span
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-admin-muted"
      >
        {{ meta }}
        <StatusLabel
          v-if="row.inDraft"
          tone="info"
          :label="t('cmsAdmin.content.inDraft')"
        />
        <StatusLabel
          v-if="!row.enabled"
          tone="muted"
          :label="t('cmsAdmin.content.hidden')"
        />
        <StatusLabel v-if="appears" tone="warning" :label="appears" />
      </span>
    </div>
    <div class="col-span-2 flex flex-wrap gap-1 md:col-span-1">
      <AdminButton
        :href="pageOf(row.slug)"
        variant="ghost"
        size="sm"
        :icon="ExternalLink"
      >
        {{ t('cmsAdmin.content.view') }}
      </AdminButton>
      <AdminButton
        variant="ghost"
        size="sm"
        disabled
        :title="t('cmsAdmin.content.editSoon')"
        :icon="Pencil"
      >
        {{ t('cmsAdmin.content.edit') }}
      </AdminButton>
    </div>
  </li>
</template>
