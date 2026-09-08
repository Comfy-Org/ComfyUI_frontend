<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
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
  <!-- The icon alone does not say "app" or "graph", so hovering the card opens
    the badge into its name. -->
  <span
    class="absolute top-4 left-4 z-10 inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-black/40 px-2.5 text-white backdrop-blur-md"
    data-testid="hub-type-badge"
    :data-kind="kind"
  >
    <component :is="icons[kind]" class="size-5 shrink-0" />
    <span
      class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-out group-hover:grid-cols-[1fr]"
    >
      <span class="overflow-hidden">
        <span class="ppformula-text-center-sm pl-1.5 text-xs whitespace-nowrap">
          {{ t(labels[kind], locale) }}
        </span>
      </span>
    </span>
  </span>
</template>
