<script setup lang="ts">
import QueueRow from '@/components/cms/QueueRow.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CatalogQueueItem } from '@/lib/cms/queue'

/** Edits the team saved to the draft; they all go live with the next publish. */
const {
  items,
  openId,
  canApply,
  locale = 'en'
} = defineProps<{
  items: CatalogQueueItem[]
  openId?: string
  canApply: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ open: [id: string] }>()
const { t } = translationsFor(locale)
const columns = ['change', 'from', 'appears'] as const
</script>

<template>
  <section class="grid gap-3">
    <div class="grid gap-1">
      <h2 class="text-sm font-medium">
        {{ t('cmsAdmin.draft.team.title') }}
        <span class="ml-1 text-admin-muted tabular-nums">
          {{ items.length }}
        </span>
      </h2>
      <p class="text-xs text-admin-muted">
        {{ t('cmsAdmin.draft.team.help') }}
      </p>
    </div>
    <div
      role="table"
      class="overflow-hidden rounded-lg border border-admin-line"
    >
      <div
        role="row"
        class="hidden min-h-10 grid-cols-[3.5rem_minmax(0,1fr)_11rem_10rem_1rem] items-center gap-3 border-b border-admin-line bg-admin-card px-4 text-xs font-medium tracking-[0.06em] text-admin-muted uppercase md:grid"
      >
        <span role="columnheader" />
        <span v-for="column in columns" :key="column" role="columnheader">
          {{ t(`cmsAdmin.draft.columns.${column}`) }}
        </span>
        <span role="columnheader" />
      </div>
      <QueueRow
        v-for="item in items"
        :key="item.id"
        :item
        :active="openId === item.id"
        :can-apply="canApply"
        :locale
        @open="emit('open', item.id)"
      />
    </div>
  </section>
</template>
