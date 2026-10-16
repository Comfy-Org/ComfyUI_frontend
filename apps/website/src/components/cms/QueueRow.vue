<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import ReadinessFlag from '@/components/cms/ReadinessFlag.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'

const {
  item,
  active,
  selectable = false,
  selected = false,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  active: boolean
  /** Show a checkbox so the row can be picked for the next publish. */
  selectable?: boolean
  selected?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ open: []; select: [] }>()
const { t } = translationsFor(locale)

const later = isFuture(item.source === 'catalog' ? item.visibleFrom : undefined)
const source =
  item.source === 'submission'
    ? item.author
    : (item.provider ?? t('cmsAdmin.draft.catalogSource'))
const when =
  item.source === 'submission'
    ? formatUtc(item.submittedAt, locale)
    : item.visibleFrom && later
      ? t('cmsAdmin.content.appears', {
          date: formatUtc(item.visibleFrom, locale)
        })
      : ''
</script>

<template>
  <div
    role="row"
    :class="
      cn(
        'grid min-h-14 cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-admin-hover px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-admin-hover md:grid-cols-[3.5rem_minmax(0,1fr)_14rem]',
        selectable &&
          'grid-cols-[1rem_3.5rem_minmax(0,1fr)] md:grid-cols-[1rem_3.5rem_minmax(0,1fr)_14rem]',
        (active || selected) && 'bg-admin-line hover:bg-admin-line'
      )
    "
    @click="emit('open')"
  >
    <span v-if="selectable" role="cell" class="flex" @click.stop>
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="t('cmsAdmin.stage.select', { title: item.title })"
        class="size-4 cursor-pointer accent-admin-fg"
        @change="emit('select')"
      />
    </span>
    <QueueThumb
      role="cell"
      :src="item.thumbnail"
      :kind="item.kind"
      class="w-14"
    />
    <span role="cell" class="grid min-w-0 gap-1">
      <button
        type="button"
        class="cursor-pointer truncate text-left text-admin-fg outline-none focus-visible:underline"
        @click.stop="emit('open')"
      >
        {{ item.title }}
      </button>
      <span
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-admin-muted"
      >
        <ChangeTag :change="item.change" :locale />
        {{ t(`cmsAdmin.kind.${item.kind}`) }}
        <ReadinessFlag
          v-if="item.source === 'catalog'"
          :gaps="item.gaps"
          :locale
        />
      </span>
    </span>
    <span role="cell" class="hidden min-w-0 md:grid">
      <span class="truncate">{{ source }}</span>
      <span
        :class="cn('text-xs text-admin-muted', later && 'text-admin-warning')"
      >
        {{ when }}
      </span>
    </span>
  </div>
</template>
