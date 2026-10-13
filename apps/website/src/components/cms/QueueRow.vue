<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import ReadinessFlag from '@/components/cms/ReadinessFlag.vue'
import StageDecision from '@/components/cms/StageDecision.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'
import type { StageEntry, StageStatus } from '@/lib/cms/stage-status'

const {
  item,
  stage,
  active,
  canApply,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  stage: StageEntry
  active: boolean
  canApply: boolean
  locale?: Locale
}>()
const emit = defineEmits<{
  open: []
  decide: [status: StageStatus]
  reject: []
}>()
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
        'grid min-h-14 cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-admin-hover px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-admin-hover md:grid-cols-[3.5rem_minmax(0,1fr)_11rem_auto]',
        active && 'bg-admin-line hover:bg-admin-line'
      )
    "
    @click="emit('open')"
  >
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
        <span v-if="stage.reapproval" class="text-admin-warning">
          {{ t('cmsAdmin.stage.reapproval') }}
        </span>
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
    <span
      role="cell"
      class="col-span-2 flex items-center justify-end gap-1 md:col-span-1"
      @click.stop
    >
      <StageDecision
        :status="stage.status"
        :title="item.title"
        :can-apply="canApply"
        :can-reject="item.source === 'submission'"
        :locale
        @decide="emit('decide', $event)"
        @reject="emit('reject')"
      />
    </span>
  </div>
</template>
