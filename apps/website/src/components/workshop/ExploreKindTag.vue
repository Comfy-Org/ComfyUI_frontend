<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import IconApps from '@/components/hub/IconApps.vue'
import IconModel from '@/components/hub/IconModel.vue'
import IconWorkflow from '@/components/hub/IconWorkflow.vue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ExploreKind } from '@/lib/workshop/explore-search'

const { kind, locale = 'en' } = defineProps<{
  kind: ExploreKind
  locale?: Locale
}>()
const { t } = translationsFor(locale)

// The same surface each kind's door on the Hub wears.
const KINDS = {
  app: {
    label: 'workshop.explore.kindApp',
    icon: IconApps,
    surface: 'bg-cobalt-800'
  },
  workflow: {
    label: 'workshop.explore.workflowPill',
    icon: IconWorkflow,
    surface: 'bg-primary-comfy-plum'
  },
  model: {
    label: 'workshop.explore.kindModel',
    icon: IconModel,
    surface: 'bg-illustration-forest'
  }
} as const satisfies Record<
  ExploreKind,
  { label: TranslationKey; icon: typeof IconApps; surface: string }
>
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-2xs/none font-semibold tracking-wider text-primary-warm-white uppercase',
        KINDS[kind].surface
      )
    "
    data-testid="explore-kind"
    :data-kind="kind"
  >
    <component :is="KINDS[kind].icon" class="size-3 shrink-0" />
    {{ t(KINDS[kind].label) }}
  </span>
</template>
