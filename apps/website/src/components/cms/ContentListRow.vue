<script setup lang="ts">
import { ExternalLink, Pencil } from '@lucide/vue'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminTooltip from '@/components/cms/ui/AdminTooltip.vue'
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
    class="grid min-h-14 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-admin-hover px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-admin-hover"
  >
    <QueueThumb :src="row.thumbnail" class="w-14" />
    <div class="grid min-w-0 gap-1">
      <span class="truncate">{{ row.title }}</span>
      <span
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-admin-muted"
      >
        {{ meta }}
        <StatusLabel
          v-if="row.archived"
          tone="muted"
          :label="t('cmsAdmin.editor.archived')"
        />
        <StatusLabel
          v-else-if="row.isNew"
          tone="success"
          :label="t('cmsAdmin.change.new')"
        />
        <StatusLabel
          v-else-if="row.inDraft"
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
    <div class="flex gap-1">
      <AdminTooltip :content="t('cmsAdmin.content.view')">
        <AdminButton
          :href="row.isNew ? `${row.slug}/?preview=DRAFT` : pageOf(row.slug)"
          target="_blank"
          rel="noopener"
          variant="ghost"
          size="icon"
          :aria-label="t('cmsAdmin.content.view')"
        >
          <ExternalLink class="size-4" />
        </AdminButton>
      </AdminTooltip>
      <AdminTooltip :content="t('cmsAdmin.content.edit')">
        <AdminButton
          :href="`/admin/edit/${row.uid}`"
          variant="ghost"
          size="icon"
          :aria-label="t('cmsAdmin.content.edit')"
        >
          <Pencil class="size-4" />
        </AdminButton>
      </AdminTooltip>
    </div>
  </li>
</template>
