<script setup lang="ts">
import QueueRow from '@/components/cms/QueueRow.vue'
import type { Locale } from '@/i18n/translations'
import type { QueueItem } from '@/lib/cms/queue'

/** One block of Draft rows, each of which can be ticked for the next publish. */
const {
  title,
  help,
  items,
  openId,
  selectable = false,
  selected = [],
  locale = 'en'
} = defineProps<{
  title: string
  help?: string
  items: QueueItem[]
  openId?: string
  selectable?: boolean
  selected?: string[]
  locale?: Locale
}>()
const emit = defineEmits<{ open: [id: string]; select: [id: string] }>()
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
        :active="openId === item.id"
        :selectable
        :selected="selected.includes(item.id)"
        :locale
        @open="emit('open', item.id)"
        @select="emit('select', item.id)"
      />
    </div>
  </section>
</template>
