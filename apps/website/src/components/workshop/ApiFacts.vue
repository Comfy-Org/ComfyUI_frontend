<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'

const {
  where,
  rows,
  note,
  locale = 'en'
} = defineProps<{
  where: string
  rows: readonly {
    label: string
    value: string
    mono?: boolean
    /** Present on a value worth taking away, which then keeps to one line. */
    copyLabel?: string
  }[]
  /** What the reader needs before any of this works, kept with the facts. */
  note?: string
  locale?: Locale
}>()
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-2xl border border-transparency-white-t20 p-6"
    data-testid="api-facts"
  >
    <span
      class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
    >
      {{ t('workshop.api.needs', locale) }}
    </span>
    <p class="text-lg font-semibold text-primary-warm-white">{{ where }}</p>
    <div class="h-px bg-transparency-white-t8"></div>
    <dl
      class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm/relaxed"
    >
      <template v-for="row in rows" :key="row.label">
        <dt class="text-primary-warm-gray">{{ row.label }}</dt>
        <dd v-if="row.copyLabel" class="m-0 flex min-w-0 items-center gap-1">
          <span
            :class="
              cn(
                'min-w-0 truncate text-primary-warm-white',
                row.mono && 'font-mono text-xs'
              )
            "
            :title="row.value"
          >
            {{ row.value }}
          </span>
          <CopyTextButton
            :value="row.value"
            :label="row.copyLabel"
            :copied-label="t('workshop.api.copied', locale)"
            class="-mr-1 h-8 min-w-8 px-1.5"
            icon-class="size-4"
          />
        </dd>
        <dd
          v-else
          :class="
            cn(
              'm-0 min-w-0 wrap-break-word text-primary-warm-white',
              row.mono && 'font-mono text-xs'
            )
          "
        >
          {{ row.value }}
        </dd>
      </template>
    </dl>
    <template v-if="note">
      <div class="h-px bg-transparency-white-t8"></div>
      <p
        class="text-sm/relaxed text-primary-warm-gray"
        data-testid="api-facts-note"
      >
        {{ note }}
      </p>
    </template>
  </div>
</template>
