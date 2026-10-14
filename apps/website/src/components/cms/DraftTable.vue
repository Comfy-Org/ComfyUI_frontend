<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import QueueRow from '@/components/cms/QueueRow.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueItem } from '@/lib/cms/queue'

/** The draft's changes as one table; the header box ticks every row shown. */
const {
  items,
  openId,
  selectable = false,
  selected = [],
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  openId?: string
  selectable?: boolean
  selected?: string[]
  locale?: Locale
}>()
const emit = defineEmits<{
  open: [id: string]
  select: [id: string]
  all: [checked: boolean]
}>()
const { t } = translationsFor(locale)
const picked = () => items.filter((item) => selected.includes(item.id)).length
</script>

<template>
  <div role="table" class="overflow-hidden rounded-lg border border-admin-line">
    <div
      role="row"
      :class="
        cn(
          'grid h-10 grid-cols-[minmax(0,1fr)] items-center gap-x-3 border-b border-admin-line bg-admin-chrome px-4 text-xs text-admin-muted md:grid-cols-[minmax(0,1fr)_14rem]',
          selectable &&
            'grid-cols-[1rem_minmax(0,1fr)] md:grid-cols-[1rem_minmax(0,1fr)_14rem]'
        )
      "
    >
      <span v-if="selectable" role="columnheader" class="flex">
        <input
          type="checkbox"
          :checked="items.length > 0 && picked() === items.length"
          :indeterminate="picked() > 0 && picked() < items.length"
          :aria-label="t('cmsAdmin.bulk.selectAll', { count: items.length })"
          class="size-4 cursor-pointer accent-admin-fg"
          @change="emit('all', ($event.target as HTMLInputElement).checked)"
        />
      </span>
      <span role="columnheader">{{ t('cmsAdmin.content.columns.name') }}</span>
      <span role="columnheader" class="hidden md:block">
        {{ t('cmsAdmin.draft.columns.from') }}
      </span>
    </div>
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
    <p
      v-if="items.length === 0"
      class="px-6 py-10 text-center text-xs text-admin-muted"
    >
      {{ t('cmsAdmin.draft.noMatches') }}
    </p>
  </div>
</template>
