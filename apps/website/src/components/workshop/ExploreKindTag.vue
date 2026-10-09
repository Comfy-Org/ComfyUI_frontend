<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/ui/badge/Badge.vue'
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

// Each kind's door colour, let through over the cover like the maker mark.
const KINDS = {
  app: {
    label: 'workshop.explore.kindApp',
    icon: IconApps,
    surface: 'bg-cobalt-800/70'
  },
  workflow: {
    label: 'workshop.explore.workflowPill',
    icon: IconWorkflow,
    surface: 'bg-primary-comfy-plum/70'
  },
  model: {
    label: 'workshop.explore.kindModel',
    icon: IconModel,
    surface: 'bg-illustration-forest/70'
  }
} as const satisfies Record<
  ExploreKind,
  { label: TranslationKey; icon: typeof IconApps; surface: string }
>
</script>

<template>
  <Badge
    :class="
      cn(
        'pointer-events-none absolute top-3 left-3 z-10 font-semibold tracking-wider text-primary-warm-white uppercase backdrop-blur-md',
        KINDS[kind].surface
      )
    "
    data-testid="explore-kind"
    :data-kind="kind"
  >
    <template #prepend>
      <component :is="KINDS[kind].icon" class="size-3 shrink-0" />
    </template>
    {{ t(KINDS[kind].label) }}
  </Badge>
</template>
