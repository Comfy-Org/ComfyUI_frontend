<script setup lang="ts">
import QueueRow from '@/components/cms/QueueRow.vue'
import type { Locale } from '@/i18n/translations'
import type { QueueItem, SubmissionQueueItem } from '@/lib/cms/queue'
import type { StageEntry, StageStatus } from '@/lib/cms/stage-status'

/** One block of Draft rows; rows can be ticked for a bulk decision while they wait for review. */
const {
  title,
  help,
  items,
  stageOf,
  openId,
  canApply,
  selectable = false,
  selected = [],
  locale = 'en'
} = defineProps<{
  title: string
  help?: string
  items: QueueItem[]
  stageOf: (item: QueueItem) => StageEntry
  openId?: string
  canApply: boolean
  selectable?: boolean
  selected?: string[]
  locale?: Locale
}>()
const emit = defineEmits<{
  decide: [items: QueueItem[], status: StageStatus]
  reject: [items: SubmissionQueueItem[]]
  open: [id: string]
  select: [id: string]
}>()
</script>

<template>
  <section class="grid gap-3">
    <header class="grid gap-1">
      <h2 class="text-sm font-medium">
        {{ title }}
        <span class="ml-1 text-admin-muted tabular-nums">
          {{ items.length }}
        </span>
      </h2>
      <p v-if="help" class="text-xs text-admin-muted">{{ help }}</p>
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
        :selectable
        :selected="selected.includes(item.id)"
        :locale
        @open="emit('open', item.id)"
        @decide="emit('decide', [item], $event)"
        @reject="item.source === 'submission' && emit('reject', [item])"
        @select="emit('select', item.id)"
      />
    </div>
  </section>
</template>
