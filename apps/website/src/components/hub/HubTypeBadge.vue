<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { t } from '../../i18n/hub'
import IconModel from './IconModel.vue'
import IconWorkflow from './IconWorkflow.vue'

// One grid holds models and workflows, and the two kinds carry different
// promises, so a card says which it is before it is clicked.
type Kind = 'workflow' | 'model'

const { kind, locale = 'en' } = defineProps<{
  kind: Kind
  locale?: Locale
}>()

const icons: Record<Kind, typeof IconWorkflow> = {
  workflow: IconWorkflow,
  model: IconModel
}

const labels: Record<Kind, HubKey> = {
  workflow: 'workshop.v2.kind.workflow',
  model: 'workshop.v2.kind.model'
}
</script>

<template>
  <span
    class="pointer-events-none absolute top-4 left-4 z-20 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-black/45 px-1.5 text-2xs/4 font-semibold tracking-wide text-white uppercase backdrop-blur-md"
    data-testid="hub-type-badge"
    :data-kind="kind"
  >
    <component :is="icons[kind]" class="size-3.5 shrink-0" />
    <!-- The word opens to its own width rather than to a guessed one. -->
    <span
      class="grid grid-cols-closed items-center overflow-hidden group-focus-within:grid-cols-open group-hover:grid-cols-open motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-safe:ease-out"
    >
      <span
        class="flex min-w-0 items-center ps-1.5 leading-none whitespace-nowrap"
      >
        {{ t(labels[kind], locale) }}
      </span>
    </span>
  </span>
</template>
