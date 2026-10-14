<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import ReadinessFlag from '@/components/cms/ReadinessFlag.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture, pageOf } from '@/lib/cms/format'
import type { ContentRow } from '@/lib/cms/queue'
import { compactCount } from '@/lib/cms/stats'

/** One page in All content; the whole row opens its editor. */
const { row, locale = 'en' } = defineProps<{
  row: ContentRow
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const editHref = `/admin/edit/${row.uid}`
const appears = isFuture(row.visibleFrom)
  ? t('cmsAdmin.content.appears', {
      date: formatUtc(row.visibleFrom ?? '', locale)
    })
  : ''
const meta = [t(`cmsAdmin.kind.${row.kind}`), row.provider]
  .filter(Boolean)
  .join(' · ')
const count = (value?: number) =>
  value === undefined ? '—' : compactCount(value, locale)
const numberCell =
  'hidden px-3 py-2 text-right text-xs text-admin-muted tabular-nums md:table-cell'
</script>

<template>
  <tr
    class="cursor-pointer border-b border-admin-hover text-sm transition-colors last:border-b-0 hover:bg-admin-hover"
    @click="$el.querySelector('a[data-row-link]')?.click()"
  >
    <td class="py-2 pr-3 pl-4">
      <div class="flex min-w-0 items-center gap-3">
        <QueueThumb
          :src="row.thumbnail"
          :kind="row.kind"
          class="w-12 shrink-0"
        />
        <div class="grid min-w-0 gap-0.5">
          <a
            data-row-link
            :href="editHref"
            class="truncate text-admin-fg outline-none focus-visible:underline"
            @click.stop
          >
            {{ row.title }}
          </a>
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
            <ReadinessFlag :gaps="row.gaps" :locale />
          </span>
        </div>
      </div>
    </td>
    <td :class="numberCell">{{ count(row.stats.popularity) }}</td>
    <td :class="numberCell">{{ count(row.stats.runs) }}</td>
    <td :class="numberCell">{{ count(row.stats.downloads) }}</td>
    <td class="py-2 pr-4 pl-2 text-right" @click.stop>
      <AdminButton
        :href="row.isNew ? `${row.slug}/?preview=DRAFT` : pageOf(row.slug)"
        target="_blank"
        rel="noopener"
        variant="ghost"
        size="icon"
        :aria-label="t('cmsAdmin.content.viewTitle', { title: row.title })"
        :title="t('cmsAdmin.content.view')"
      >
        <ExternalLink class="size-4" />
      </AdminButton>
    </td>
  </tr>
</template>
