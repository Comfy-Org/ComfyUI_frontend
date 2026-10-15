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
  canEdit = false,
  disabled = false,
  locale = 'en'
} = defineProps<{
  items: QueueItem[]
  openId?: string
  selectable?: boolean
  selected?: string[]
  canEdit?: boolean
  disabled?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  open: [id: string, trigger?: HTMLElement]
  select: [id: string]
  all: [checked: boolean]
  discard: [id: string]
}>()
const { t } = translationsFor(locale)
const picked = () => items.filter((item) => selected.includes(item.id)).length
function selectShown(event: Event) {
  if (!disabled && event.target instanceof HTMLInputElement)
    emit('all', event.target.checked)
}
</script>

<template>
  <div
    role="table"
    :aria-label="t('cccStaging.changes')"
    class="overflow-hidden rounded-lg border border-admin-line"
  >
    <div
      role="row"
      :class="
        cn(
          'grid h-10 grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 border-b border-admin-line bg-admin-chrome px-4 text-xs text-admin-muted md:grid-cols-[minmax(0,1fr)_12rem_3.5rem]',
          selectable &&
            'grid-cols-[1rem_minmax(0,1fr)_3.5rem] md:grid-cols-[1rem_minmax(0,1fr)_12rem_3.5rem]'
        )
      "
    >
      <span v-if="selectable" role="columnheader" class="flex">
        <input
          type="checkbox"
          :checked="items.length > 0 && picked() === items.length"
          :indeterminate="picked() > 0 && picked() < items.length"
          :aria-label="t('cccChecked.selectShown')"
          :disabled
          class="size-4 cursor-pointer accent-admin-fg"
          @change="selectShown"
        />
      </span>
      <span role="columnheader" class="sr-only">{{
        t('cmsAdmin.review.actions')
      }}</span>
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
      :can-edit
      :disabled
      :locale
      @open="(trigger) => emit('open', item.id, trigger)"
      @select="emit('select', item.id)"
      @discard="emit('discard', item.id)"
    />
    <p
      v-if="items.length === 0"
      class="px-6 py-10 text-center text-xs text-admin-muted"
    >
      {{ t('cmsAdmin.draft.noMatches') }}
    </p>
  </div>
</template>
