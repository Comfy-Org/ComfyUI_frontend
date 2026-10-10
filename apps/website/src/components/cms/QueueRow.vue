<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import ReadinessFlag from '@/components/cms/ReadinessFlag.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'

const {
  item,
  active,
  canToggle,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  active: boolean
  canToggle: boolean
  locale?: Locale
}>()
const included = defineModel<boolean>('included', { required: true })
const emit = defineEmits<{ open: [] }>()
const { t } = translationsFor(locale)

const lockedNote =
  item.source === 'catalog' ? t('cmsAdmin.draft.catalogLocked') : undefined
const later = isFuture(item.source === 'catalog' ? item.visibleFrom : undefined)
const source =
  item.source === 'submission'
    ? item.author
    : (item.provider ?? t('cmsAdmin.draft.catalogSource'))
const submitted =
  item.source === 'submission' ? formatUtc(item.submittedAt, locale) : ''
const appears =
  item.change === 'removed'
    ? t('cmsAdmin.draft.removedOnPublish')
    : item.source === 'catalog' && item.visibleFrom
      ? formatUtc(item.visibleFrom, locale)
      : t('cmsAdmin.draft.onPublish')
</script>

<template>
  <div
    role="row"
    :class="
      cn(
        'grid min-h-14 cursor-pointer grid-cols-[1rem_3.5rem_minmax(0,1fr)_1rem] items-center gap-3 border-b border-admin-hover px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-admin-hover md:grid-cols-[1rem_3.5rem_minmax(0,1fr)_11rem_10rem_1rem]',
        active && 'bg-admin-line hover:bg-admin-line'
      )
    "
    @click="emit('open')"
  >
    <span role="cell" class="flex" @click.stop>
      <Checkbox
        v-model="included"
        :disabled="!canToggle"
        :title="lockedNote"
        :aria-label="t('cmsAdmin.draft.include', { title: item.title })"
      />
    </span>
    <QueueThumb
      role="cell"
      :src="item.thumbnail"
      :class="cn('w-14', !included && 'opacity-40')"
    />
    <span
      role="cell"
      :class="cn('grid min-w-0 gap-1', !included && 'opacity-50')"
    >
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
        <span v-if="!included" class="text-admin-warning">
          {{ t('cmsAdmin.draft.waits') }}
        </span>
      </span>
    </span>
    <span
      role="cell"
      :class="cn('hidden min-w-0 md:grid', !included && 'opacity-50')"
    >
      <span class="truncate">{{ source }}</span>
      <span class="text-xs text-admin-muted">{{ submitted }}</span>
    </span>
    <span role="cell" :class="cn('hidden md:grid', !included && 'opacity-50')">
      <span :class="cn(later && 'text-admin-warning')">{{ appears }}</span>
      <span v-if="later" class="text-xs text-admin-muted">
        {{ t('cmsAdmin.draft.hiddenUntil') }}
      </span>
    </span>
    <ChevronRight
      role="cell"
      class="size-4 text-admin-subtle"
      aria-hidden="true"
    />
  </div>
</template>
