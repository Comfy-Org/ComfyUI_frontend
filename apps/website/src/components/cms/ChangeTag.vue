<script setup lang="ts">
import type { StatusTone } from '@/components/cms/ui/status'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { QueueChange } from '@/lib/cms/queue'

const { change, locale = 'en' } = defineProps<{
  change: QueueChange
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const tones: Record<QueueChange, StatusTone> = {
  new: 'success',
  updated: 'info',
  removed: 'danger'
}
</script>

<template>
  <StatusLabel :tone="tones[change]" :label="t(`cmsAdmin.change.${change}`)" />
</template>
