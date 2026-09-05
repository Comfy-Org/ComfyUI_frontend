<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { DirectoryRow } from '../../utils/eventsDirectory'

import AddToCalendarButton from '../../components/blocks/AddToCalendarButton.vue'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'

const { row, locale = 'en' } = defineProps<{
  row: DirectoryRow
  locale?: Locale
}>()

// The list rows and the cards share one CTA so the upcoming/past rules can
// never drift apart between the two views.
const chipClass =
  'inline-flex cursor-pointer rounded-full border border-primary-comfy-yellow/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-primary-comfy-yellow uppercase transition-colors hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
</script>

<template>
  <AddToCalendarButton v-if="row.calendar" :event="row.calendar" :locale>
    <template #trigger>
      <button type="button" :class="chipClass">
        {{ t('events.directory.saveTheDate', locale) }}
      </button>
    </template>
  </AddToCalendarButton>

  <a
    v-else-if="row.watch"
    :href="row.watch.href"
    :target="row.watch.newTab ? '_blank' : undefined"
    :rel="row.watch.newTab ? resolveRel({ target: '_blank' }) : undefined"
    :class="chipClass"
  >
    {{ t('events.past.watchNow', locale) }}
  </a>
</template>
