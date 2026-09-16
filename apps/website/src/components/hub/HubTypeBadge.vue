<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import IconApps from './IconApps.vue'
import IconModel from './IconModel.vue'
import IconWorkflow from './IconWorkflow.vue'

// One grid holds models, workflows and apps, and the two kinds carry different
// promises, so a card says which it is before it is clicked.
type Kind = 'workflow' | 'app' | 'model'

const { kind, locale = 'en' } = defineProps<{
  kind: Kind
  locale?: Locale
}>()

const icons: Record<Kind, typeof IconWorkflow> = {
  workflow: IconWorkflow,
  app: IconApps,
  model: IconModel
}

const labels: Record<Kind, TranslationKey> = {
  workflow: 'workshop.v2.kind.workflow',
  app: 'workshop.v2.kind.app',
  model: 'workshop.v2.kind.model'
}
</script>

<template>
  <span
    class="pointer-events-none absolute top-4 left-4 z-20 inline-flex h-7 items-center rounded-lg bg-black/45 px-2.5 text-2xs/4 font-semibold tracking-wide text-white uppercase backdrop-blur-md"
    data-testid="hub-type-badge"
    :data-kind="kind"
  >
    <component :is="icons[kind]" class="size-3.5 shrink-0" />
    <!-- A grid track running from 0fr to 1fr is what lets the word open to its
      own width instead of to a guessed one. -->
    <span
      class="grid grid-cols-[0fr] overflow-hidden group-focus-within:grid-cols-[1fr] group-hover:grid-cols-[1fr] motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-safe:ease-out"
    >
      <span class="min-w-0 ps-1.5 whitespace-nowrap">
        {{ t(labels[kind], locale) }}
      </span>
    </span>
  </span>
</template>
