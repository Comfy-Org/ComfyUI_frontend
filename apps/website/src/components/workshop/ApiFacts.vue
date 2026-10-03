<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

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
const { t } = translationsFor(locale)
</script>

<template>
  <div
    class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light"
    data-testid="api-facts"
  >
    <h3
      class="m-0 border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.api.needs') }}
    </h3>
    <div class="flex flex-col gap-5 p-5">
      <dl
        class="m-0 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm/relaxed"
      >
        <dt class="text-primary-warm-gray">
          {{ t('workshop.api.runsOn') }}
        </dt>
        <dd class="m-0 min-w-0 text-primary-warm-white">{{ where }}</dd>
        <template v-for="row in rows" :key="row.label">
          <dt class="text-primary-warm-gray">{{ row.label }}</dt>
          <dd v-if="row.copyLabel" class="m-0 flex min-w-0 items-center gap-1">
            <span
              :class="
                cn(
                  'min-w-0 flex-1 truncate text-xs/relaxed text-primary-warm-white',
                  row.mono && 'font-mono'
                )
              "
              :title="row.value"
            >
              {{ row.value }}
            </span>
            <CopyTextButton
              :value="row.value"
              :label="row.copyLabel"
              :copied-label="t('workshop.api.copied')"
              class="-mr-1 h-8 min-w-8 px-1.5"
              icon-class="size-4"
            />
          </dd>
          <dd
            v-else
            :class="
              cn(
                'm-0 min-w-0 text-xs/relaxed wrap-break-word text-primary-warm-white',
                row.mono && 'font-mono'
              )
            "
          >
            {{ row.value }}
          </dd>
        </template>
      </dl>
      <p
        v-if="note"
        class="text-sm/relaxed text-primary-warm-gray"
        data-testid="api-facts-note"
      >
        {{ note }}
      </p>
    </div>
  </div>
</template>
