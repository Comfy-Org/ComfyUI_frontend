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
  <li class="overflow-hidden rounded-xl border border-transparency-white-t8">
    <p
      class="border-b border-transparency-white-t8 bg-site-bg-soft px-4 py-2 text-xs text-primary-comfy-canvas"
    >
      {{ humanizeField(group.field) }}
    </p>
    <dl class="grid text-sm">
      <div
        v-if="showBefore"
        class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-4 py-2 text-primary-comfy-canvas"
      >
        <dt>{{ t('cmsAdmin.review.before') }}</dt>
        <dd
          class="wrap-break-word line-through decoration-destructive-light/60"
        >
          {{ formatValue(group.before) || empty }}
        </dd>
      </div>
      <div
        v-if="showAfter"
        :class="
          cn(
            'grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-4 py-2 text-primary-warm-white',
            showBefore && 'border-t border-dashed border-transparency-white-t8'
          )
        "
      >
        <dt class="text-primary-comfy-canvas">
          {{ t('cmsAdmin.review.after') }}
        </dt>
        <dd v-if="highlight" class="flex flex-wrap gap-1 wrap-break-word">
          <span
            v-for="(value, i) in afterList"
            :key="i"
            :class="
              cn(
                isAdded(value) &&
                  'rounded-sm bg-primary-comfy-yellow/15 px-1 text-primary-comfy-yellow'
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
