<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import FieldValue from '@/components/cms/FieldValue.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { humanizeField } from '@/lib/cms/format'
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
const sides = [
  showBefore && { side: 'before' as const, value: group.before },
  showAfter && { side: 'after' as const, value: group.after }
].filter((entry) => entry !== false)
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
        v-for="({ side, value }, i) in sides"
        :key="side"
        :class="
          cn(
            'grid grid-cols-[4rem_minmax(0,1fr)] gap-2 px-3 py-2',
            side === 'before' ? 'bg-admin-danger/6' : 'bg-admin-success/6',
            i > 0 && 'border-t border-admin-line'
          )
        "
      >
        <dt class="text-xs leading-5 text-admin-muted">
          {{ t(`cmsAdmin.review.${side}`) }}
        </dt>
        <FieldValue
          :value
          :side
          :added="group.added"
          :empty="t('cmsAdmin.review.empty')"
        />
      </div>
    </dl>
  </li>
</template>
