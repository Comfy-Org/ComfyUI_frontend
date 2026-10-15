<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** "26–50 of 181" with previous and next page buttons. */
const {
  total,
  pageSize,
  locale = 'en'
} = defineProps<{ total: number; pageSize: number; locale?: Locale }>()
const page = defineModel<number>({ required: true })
const { t } = translationsFor(locale)
const pages = () => Math.max(1, Math.ceil(total / pageSize))
</script>

<template>
  <nav
    :aria-label="t('cmsAdmin.pagination.label')"
    class="flex flex-wrap items-center justify-between gap-3 text-xs text-admin-muted"
  >
    <span class="tabular-nums">
      {{
        t('cmsAdmin.pagination.range', {
          from: total ? (page - 1) * pageSize + 1 : 0,
          to: Math.min(page * pageSize, total),
          total
        })
      }}
    </span>
    <span v-if="pages() > 1" class="flex items-center gap-1">
      <AdminButton
        variant="ghost"
        size="icon"
        :disabled="page <= 1"
        :aria-label="t('cmsAdmin.pagination.previous')"
        @click="page -= 1"
      >
        <ChevronLeft class="size-4" />
      </AdminButton>
      <span class="px-1 tabular-nums">
        {{ t('cmsAdmin.pagination.page', { page, pages: pages() }) }}
      </span>
      <AdminButton
        variant="ghost"
        size="icon"
        :disabled="page >= pages()"
        :aria-label="t('cmsAdmin.pagination.next')"
        @click="page += 1"
      >
        <ChevronRight class="size-4" />
      </AdminButton>
    </span>
  </nav>
</template>
