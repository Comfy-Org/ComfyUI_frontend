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
  <!-- Spelled out at rest. A type that only appears on hover is a type the
    reader does not have at the moment they need it. -->
  <span
    class="pointer-events-none absolute top-4 left-4 z-20 inline-flex h-7 items-center gap-1.5 rounded-lg bg-black/45 px-2.5 text-2xs/none font-medium tracking-wide text-white uppercase backdrop-blur-md"
    data-testid="hub-type-badge"
    :data-kind="kind"
  >
    <component :is="icons[kind]" class="size-3.5 shrink-0" />
    {{ t(labels[kind], locale) }}
  </span>
</template>
