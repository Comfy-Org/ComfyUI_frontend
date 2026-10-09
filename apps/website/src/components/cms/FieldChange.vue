<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { formatValue, humanizeField } from '@/lib/cms/format'
import type { CatalogQueueItem } from '@/lib/cms/queue'

const {
  group,
  showBefore,
  showAfter,
  locale = 'en'
} = defineProps<{
  group: CatalogQueueItem['fields'][number]
  showBefore: boolean
  showAfter: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const empty = t('cmsAdmin.review.empty')
const afterList = Array.isArray(group.after) ? group.after : []
const highlight = group.added.length > 0 && afterList.length > 0
const isAdded = (value: unknown) => group.added.includes(value)
</script>

<template>
  <li class="overflow-hidden rounded-lg border border-admin-line">
    <p
      class="border-b border-admin-line bg-admin-page px-3 py-1.5 text-xs text-admin-muted"
    >
      {{ humanizeField(group.field) }}
    </p>
    <dl class="grid text-sm">
      <div
        v-if="showBefore"
        class="grid grid-cols-[4rem_minmax(0,1fr)] gap-2 bg-admin-danger/6 px-3 py-2"
      >
        <dt class="text-xs leading-5 text-admin-muted">
          {{ t('cmsAdmin.review.before') }}
        </dt>
        <dd
          class="wrap-break-word text-admin-muted line-through decoration-admin-danger-text/50"
        >
          {{ formatValue(group.before) || empty }}
        </dd>
      </div>
      <div
        v-if="showAfter"
        :class="
          cn(
            'grid grid-cols-[4rem_minmax(0,1fr)] gap-2 bg-admin-success/6 px-3 py-2',
            showBefore && 'border-t border-admin-line'
          )
        "
      >
        <dt class="text-xs leading-5 text-admin-muted">
          {{ t('cmsAdmin.review.after') }}
        </dt>
        <dd v-if="highlight" class="flex flex-wrap gap-1 wrap-break-word">
          <span
            v-for="(value, i) in afterList"
            :key="i"
            :class="
              cn(
                'rounded-sm px-1',
                isAdded(value)
                  ? 'bg-admin-success/15 text-admin-success'
                  : 'bg-admin-hover'
              )
            "
            >{{ formatValue(value) }}</span
          >
        </dd>
        <dd v-else class="wrap-break-word">
          {{ formatValue(group.after) || empty }}
        </dd>
      </div>
    </dl>
  </li>
</template>
