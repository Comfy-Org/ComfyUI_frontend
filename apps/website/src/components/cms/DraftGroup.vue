<script setup lang="ts">
import { Check, Clock } from '@lucide/vue'
import { computed } from 'vue'

import QueueRow from '@/components/cms/QueueRow.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueItem, SubmissionQueueItem } from '@/lib/cms/queue'
import type { StageEntry, StageStatus } from '@/lib/cms/stage-status'

/** One block of Draft rows, with bulk decisions while they wait for review. */
const {
  title,
  help,
  items,
  stageOf,
  openId,
  canApply,
  bulk = false,
  locale = 'en'
} = defineProps<{
  title: string
  help?: string
  items: QueueItem[]
  stageOf: (item: QueueItem) => StageEntry
  openId?: string
  canApply: boolean
  /** Offer approve and later (and reject, for workflows) on every row at once. */
  bulk?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  decide: [items: QueueItem[], status: StageStatus]
  reject: [items: SubmissionQueueItem[]]
  open: [id: string]
}>()
const { t } = translationsFor(locale)
const submissions = computed(() =>
  items.filter(
    (item): item is SubmissionQueueItem => item.source === 'submission'
  )
)
const showBulk = computed(() => bulk && canApply && items.length > 1)
</script>

<template>
  <section class="grid gap-3">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="grid gap-1">
        <h2 class="text-sm font-medium">
          {{ title }}
          <span class="ml-1 text-admin-muted tabular-nums">
            {{ items.length }}
          </span>
        </h2>
        <p v-if="help" class="text-xs text-admin-muted">{{ help }}</p>
      </div>
      <div v-if="showBulk" class="flex flex-wrap gap-1">
        <AdminButton
          v-if="submissions.length === items.length"
          variant="dangerGhost"
          @click="emit('reject', submissions)"
        >
          {{
            t(
              'cmsAdmin.draft.bulk.reject',
              { count: items.length },
              items.length
            )
          }}
        </AdminButton>
        <AdminButton
          variant="ghost"
          :icon="Clock"
          @click="emit('decide', items, 'DEFERRED')"
        >
          {{ t('cmsAdmin.stage.laterAll', { count: items.length }) }}
        </AdminButton>
        <AdminButton :icon="Check" @click="emit('decide', items, 'APPROVED')">
          {{
            t(
              'cmsAdmin.draft.bulk.approve',
              { count: items.length },
              items.length
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
        :stage="stageOf(item)"
        :active="openId === item.id"
        :can-apply="canApply"
        :locale
        @open="emit('open', item.id)"
        @decide="emit('decide', [item], $event)"
        @reject="item.source === 'submission' && emit('reject', [item])"
      />
    </div>
  </section>
</template>
