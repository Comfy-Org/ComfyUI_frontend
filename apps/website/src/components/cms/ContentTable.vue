<script setup lang="ts">
import ContentTableRow from '@/components/cms/ContentTableRow.vue'
import SortHeader from '@/components/cms/SortHeader.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ContentRow } from '@/lib/cms/queue'
import type { SortOrder } from '@/lib/cms/stats'

/** All content as a table: sortable columns, one page of rows at a time. */
const {
  rows,
  emptyText,
  locale = 'en'
} = defineProps<{ rows: ContentRow[]; emptyText: string; locale?: Locale }>()
const order = defineModel<SortOrder>('order', { required: true })
const { t } = translationsFor(locale)
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-admin-line">
    <table class="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col class="hidden w-28 md:table-column" />
        <col class="hidden w-24 md:table-column" />
        <col class="hidden w-28 md:table-column" />
        <col class="w-14" />
      </colgroup>
      <thead
        class="border-b border-admin-line bg-admin-chrome text-left text-xs text-admin-muted"
      >
        <tr>
          <SortHeader
            v-model="order"
            column="name"
            :label="t('cmsAdmin.content.columns.name')"
            class="pl-4"
          />
          <SortHeader
            v-model="order"
            column="popularity"
            :label="t('cmsAdmin.stats.popularity')"
            numeric
            class="hidden md:table-cell"
          />
          <SortHeader
            v-model="order"
            column="runs"
            :label="t('cmsAdmin.stats.runs')"
            numeric
            class="hidden md:table-cell"
          />
          <SortHeader
            v-model="order"
            column="downloads"
            :label="t('cmsAdmin.stats.downloads')"
            numeric
            class="hidden md:table-cell"
          />
          <th scope="col">
            <span class="sr-only">{{ t('cmsAdmin.content.view') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td
            colspan="5"
            class="px-6 py-10 text-center text-xs text-admin-muted"
          >
            {{ emptyText }}
          </td>
        </tr>
        <ContentTableRow v-for="row in rows" :key="row.uid" :row :locale />
      </tbody>
    </table>
  </div>
</template>
