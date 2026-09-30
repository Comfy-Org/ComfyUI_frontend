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
    class="flex flex-col gap-5 rounded-2xl border border-transparency-white-t20 p-6"
    data-testid="api-facts"
  >
    <div class="flex flex-col gap-1.5">
      <span
        class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('workshop.api.needs', locale) }}
      </span>
      <p class="text-lg font-semibold text-primary-warm-white">{{ where }}</p>
    </div>
    <dl class="m-0 flex flex-col gap-4 rounded-xl bg-hub-surface p-4">
      <div v-for="row in rows" :key="row.label" class="flex flex-col gap-1">
        <dt class="text-xs text-primary-warm-gray">{{ row.label }}</dt>
        <dd v-if="row.copyLabel" class="m-0 flex min-w-0 items-center gap-2">
          <span
            :class="
              cn(
                'min-w-0 flex-1 truncate text-sm text-primary-warm-white',
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
            class="-my-1 -mr-1.5 h-7 min-w-7 px-1"
            icon-class="size-4"
          />
        </dd>
        <dd
          v-else
          :class="
            cn(
              'm-0 min-w-0 text-sm/relaxed wrap-break-word text-primary-warm-white',
              row.mono && 'font-mono text-xs/relaxed'
            )
          "
        >
          {{ row.value }}
        </dd>
      </div>
    </dl>
    <p
      v-if="note"
      class="text-sm/relaxed text-primary-warm-gray"
      data-testid="api-facts-note"
    >
      {{ note }}
    </p>
  </div>
</template>
