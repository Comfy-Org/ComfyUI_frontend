<script setup lang="ts">
import { Check } from '@lucide/vue'
import { computed } from 'vue'

import QueueRow from '@/components/cms/QueueRow.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SubmissionQueueItem } from '@/lib/cms/queue'

/** Workflows creators sent, each waiting for someone to approve or reject. */
const {
  items,
  approvedIds,
  openId,
  canApply,
  locale = 'en'
} = defineProps<{
  items: SubmissionQueueItem[]
  approvedIds: Set<string>
  openId?: string
  canApply: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  approve: [items: SubmissionQueueItem[], value: boolean]
  reject: [items: SubmissionQueueItem[]]
  open: [id: string]
}>()
const { t } = translationsFor(locale)
const undecided = computed(() =>
  items.filter((item) => !approvedIds.has(item.id))
)
const bulk = computed(() => canApply && undecided.value.length > 1)
</script>

<template>
  <section class="grid gap-3">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="grid gap-1">
        <h2 class="text-sm font-medium">
          {{ t('cmsAdmin.draft.submissions.title') }}
          <span class="ml-1 text-admin-muted tabular-nums">
            {{ items.length }}
          </span>
        </h2>
        <p class="text-xs text-admin-muted">
          {{ t('cmsAdmin.draft.submissions.help') }}
        </p>
      </div>
      <div v-if="bulk" class="flex flex-wrap gap-1">
        <AdminButton variant="dangerGhost" @click="emit('reject', undecided)">
          {{
            t(
              'cmsAdmin.draft.bulk.reject',
              { count: undecided.length },
              undecided.length
            )
          }}
        </AdminButton>
        <AdminButton :icon="Check" @click="emit('approve', undecided, true)">
          {{
            t(
              'cmsAdmin.draft.bulk.approve',
              { count: undecided.length },
              undecided.length
            )
          }}
        </AdminButton>
      </div>
    </header>
    <div
      role="table"
      class="overflow-hidden rounded-lg border border-admin-line"
    >
      <QueueRow
        v-for="item in items"
        :key="item.id"
        :item
        :approved="approvedIds.has(item.id)"
        :active="openId === item.id"
        :can-apply="canApply"
        :locale
        @update:approved="emit('approve', [item], $event)"
        @open="emit('open', item.id)"
        @reject="emit('reject', [item])"
      />
    </div>
  </section>
</template>
