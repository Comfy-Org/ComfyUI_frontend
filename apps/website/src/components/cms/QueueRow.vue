<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import ChangeTag from '@/components/cms/ChangeTag.vue'
import QueueThumb from '@/components/cms/QueueThumb.vue'
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
        'grid cursor-pointer grid-cols-[2.5rem_4rem_minmax(0,1fr)_1.5rem] items-center gap-4 border-t border-transparency-white-t8 px-4 py-3 transition-colors hover:bg-transparency-white-t4 md:grid-cols-[2.5rem_4rem_minmax(0,1fr)_11rem_10rem_1.5rem]',
        active && 'bg-transparency-white-t4'
      )
    "
    @click="emit('open')"
  >
    <span role="cell" @click.stop>
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
      :class="cn('w-16', !included && 'opacity-40')"
    />
    <span
      role="cell"
      :class="cn('grid min-w-0 gap-1', !included && 'opacity-50')"
    >
      <button
        type="button"
        class="truncate text-left font-medium text-primary-warm-white outline-none focus-visible:underline"
        @click.stop="emit('open')"
      >
        {{ item.title }}
      </button>
      <span
        class="flex flex-wrap items-center gap-2 text-xs text-primary-comfy-canvas"
      >
        <ChangeTag :change="item.change" :locale />
        {{ t(`cmsAdmin.kind.${item.kind}`) }}
        <span v-if="!included" class="text-primary-comfy-orange">
          · {{ t('cmsAdmin.draft.waits') }}
        </span>
      </span>
    </span>
    <span
      role="cell"
      :class="cn('hidden min-w-0 text-sm md:grid', !included && 'opacity-50')"
    >
      <span class="truncate">{{ source }}</span>
      <span class="text-xs text-primary-comfy-canvas">{{ submitted }}</span>
    </span>
    <span
      role="cell"
      :class="cn('hidden text-sm md:grid', !included && 'opacity-50')"
    >
      <span :class="cn(later && 'text-primary-comfy-orange')">{{
        appears
      }}</span>
      <span v-if="later" class="text-xs text-primary-comfy-canvas">
        {{ t('cmsAdmin.draft.hiddenUntil') }}
      </span>
    </span>
    <ChevronRight
      role="cell"
      class="size-4 text-primary-comfy-canvas"
      aria-hidden="true"
    />
  </div>
</template>
