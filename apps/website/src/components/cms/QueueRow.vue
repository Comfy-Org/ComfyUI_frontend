<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
import ReadinessFlag from '@/components/cms/ReadinessFlag.vue'
import SubmissionDecision from '@/components/cms/SubmissionDecision.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatUtc, isFuture } from '@/lib/cms/format'
import type { QueueItem } from '@/lib/cms/queue'

const {
  item,
  active,
  canApply,
  locale = 'en'
} = defineProps<{
  item: QueueItem
  active: boolean
  canApply: boolean
  locale?: Locale
}>()
const approved = defineModel<boolean>('approved', { default: false })
const emit = defineEmits<{ open: []; reject: [] }>()
const { t } = translationsFor(locale)

const isSubmission = item.source === 'submission'
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
        'grid min-h-14 cursor-pointer items-center gap-3 border-b border-admin-hover px-4 py-2 text-sm transition-colors last:border-b-0 hover:bg-admin-hover',
        isSubmission
          ? 'grid-cols-[3.5rem_minmax(0,1fr)_auto] md:grid-cols-[3.5rem_minmax(0,1fr)_11rem_13rem]'
          : 'grid-cols-[3.5rem_minmax(0,1fr)_1rem] md:grid-cols-[3.5rem_minmax(0,1fr)_11rem_10rem_1rem]',
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
        <ReadinessFlag
          v-if="item.source === 'catalog'"
          :gaps="item.gaps"
          :locale
        />
      </span>
    </span>
    <span role="cell" class="hidden min-w-0 md:grid">
      <span class="truncate">{{ source }}</span>
      <span class="text-xs text-admin-muted">{{ submitted }}</span>
    </span>
    <span
      v-if="isSubmission"
      role="cell"
      class="flex items-center justify-end gap-1"
      @click.stop
    >
      <SubmissionDecision
        v-model:approved="approved"
        :title="item.title"
        :can-apply="canApply"
        :locale
        @reject="emit('reject')"
      />
    </span>
    <template v-else>
      <span role="cell" class="hidden md:grid">
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
    </template>
  </div>
</template>
