<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cardBadgeClass } from '../../lib/hub/badge'
import IconApps from './IconApps.vue'
import IconModel from './IconModel.vue'
import IconWorkflow from './IconWorkflow.vue'

// The All tab mixes node graphs, apps and models in one grid, so each card
// says which of the three it is with the same icon its tab carries.
type Kind = 'nodeGraph' | 'comfyApp' | 'model'

const { kind, locale = 'en' } = defineProps<{
  kind: Kind
  locale?: Locale
}>()

const icons: Record<Kind, typeof IconWorkflow> = {
  nodeGraph: IconWorkflow,
  comfyApp: IconApps,
  model: IconModel
}

const labels: Record<Kind, TranslationKey> = {
  nodeGraph: 'workshop.hub.kind.graph',
  comfyApp: 'workshop.hub.kind.app',
  model: 'workshop.hub.kind.models'
}
</script>

<template>
  <span
    :class="cn(cardBadgeClass, 'left-4')"
    :title="t(labels[kind], locale)"
    data-testid="hub-type-badge"
    :data-kind="kind"
  >
    <span class="sr-only">{{ t(labels[kind], locale) }}</span>
    <component :is="icons[kind]" class="size-5" />
  </span>
</template>
