<script setup lang="ts">
import { Calendar, CirclePlay, Cloud, HardDrive, User } from '@lucide/vue'
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t, tPlural } from '../../i18n/translations'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import { mediaIcon, mediaLabel } from './mediaIcon'

const {
  author,
  usage,
  produces,
  runsHere,
  added,
  locale = 'en'
} = defineProps<{
  author: string
  /** How many times the registry has seen it run. */
  usage: number
  produces: readonly HubPortSummary[]
  /** Whether the model it calls runs on this page rather than on a machine. */
  runsHere: boolean
  added: string
  locale?: Locale
}>()

const output = computed(() => produces[0])

const runs = computed(() =>
  tPlural('workshop.v2.workflow.runCount', usage, locale).replace(
    String(usage),
    new Intl.NumberFormat(locale).format(usage)
  )
)

const addedOn = computed(() => {
  const date = new Date(added)
  return Number.isNaN(date.valueOf())
    ? added
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
})

const row = 'flex items-center gap-3 text-sm text-primary-comfy-canvas/80'
const icon = 'size-4 shrink-0 text-primary-warm-gray'
</script>

<template>
  <div
    class="rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-5"
    data-testid="workflow-details"
  >
    <h2
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.v2.workflow.details', locale) }}
    </h2>
    <ul class="mt-3 flex flex-col gap-2.5">
      <li :class="row">
        <User :class="icon" aria-hidden="true" />
        {{ t('workshop.workflow.by', locale).replace('{author}', author) }}
      </li>
      <li v-if="usage > 0" :class="row" data-testid="workflow-usage">
        <CirclePlay :class="icon" aria-hidden="true" />
        {{ runs }}
      </li>
      <li v-if="output" :class="row">
        <component
          :is="mediaIcon(output.media)"
          :class="icon"
          aria-hidden="true"
        />
        {{ mediaLabel(output.media, locale) }},
        {{
          t('workshop.v2.workflow.perRun', locale).replace(
            '{count}',
            String(output.count)
          )
        }}
      </li>
      <li :class="row">
        <component
          :is="runsHere ? Cloud : HardDrive"
          :class="icon"
          aria-hidden="true"
        />
        {{
          runsHere
            ? t('workshop.v2.workflow.runsCloud', locale)
            : t('workshop.v2.workflow.runsLocal', locale)
        }}
      </li>
      <li :class="row">
        <Calendar :class="icon" aria-hidden="true" />
        {{ t('workshop.v2.workflow.added', locale).replace('{date}', addedOn) }}
      </li>
    </ul>
  </div>
</template>
