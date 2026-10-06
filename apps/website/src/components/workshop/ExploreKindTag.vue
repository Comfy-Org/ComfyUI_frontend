<script setup lang="ts">
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

type Kind = 'app' | 'workflow' | 'model'

const { kind, locale = 'en' } = defineProps<{ kind: Kind; locale?: Locale }>()
const { t } = translationsFor(locale)

const labels: Record<Kind, TranslationKey> = {
  app: 'workshop.explore.kindApp',
  workflow: 'workshop.explore.workflowPill',
  model: 'workshop.explore.kindModel'
}
</script>

<template>
  <span
    class="pointer-events-none absolute top-4 right-4 z-10 rounded-lg bg-black/40 px-2 py-1 text-2xs/none font-medium text-white uppercase backdrop-blur-md"
    data-testid="explore-kind"
    :data-kind="kind"
  >
    {{ t(labels[kind]) }}
  </span>
</template>
