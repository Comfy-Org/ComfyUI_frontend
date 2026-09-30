<script setup lang="ts">
import WorkshopGate from '../workshop/WorkshopGate.vue'
import { computed, ref, watch } from 'vue'

import { catalogSearch } from '../../config/models-catalogue'
import { getRoutes } from '../../config/routes'
import type {
  DiscoveryProvider,
  DiscoveryWorkflow
} from '../../data/modelDiscovery'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopWorkflowsEnabled } from '../../scripts/posthog'
import Button from '../ui/button/Button.vue'
import type { CatalogueTab } from '../workshop/CatalogueTabs.vue'
import CatalogueTabs from '../workshop/CatalogueTabs.vue'
import DiscoveryProviderCard from './DiscoveryProviderCard.vue'
import DiscoveryWorkflowCard from './DiscoveryWorkflowCard.vue'

const {
  locale = 'en',
  providers,
  workflows = []
} = defineProps<{
  locale?: Locale
  providers: readonly DiscoveryProvider[]
  workflows?: readonly DiscoveryWorkflow[]
}>()
const routes = getRoutes(locale)

// The catalogue's own workflows half is behind a flag, so the home page offers
// the tab only where the tab has somewhere to go.
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const tabbed = computed(() => workflowsEnabled.value && workflows.length > 0)
const TABS = ['models', 'workflows'] as const satisfies readonly CatalogueTab[]
const tab = ref<CatalogueTab>('models')
const onWorkflows = computed(() => tabbed.value && tab.value === 'workflows')

// The tab decides what the row, its name and the way out of it are, and it
// decides once here rather than at every place the template names one.
const providerRow = computed(() => (onWorkflows.value ? [] : providers))
const workflowRow = computed(() => (onWorkflows.value ? workflows : []))
const rowLabel = computed(() =>
  t(
    onWorkflows.value
      ? 'modelDiscovery.workflowRowLabel'
      : 'modelDiscovery.rowLabel',
    locale
  )
)
const browseLabel = computed(() =>
  t(
    onWorkflows.value
      ? 'modelDiscovery.browseWorkflows'
      : 'modelDiscovery.browse',
    locale
  )
)
const browseHref = computed(() =>
  onWorkflows.value ? `${routes.workshop}?type=workflows` : routes.workshop
)

// The marquee travels one row's width per period, so a fixed period runs a
// longer row faster and a switch mid-stride lands it at the old row's fraction
// of a different width. A pace per card holds one speed; rewinding the running
// animation lets the row that arrives start where a row starts.
const SECONDS_PER_CARD = 3
const marqueeStyle = computed(() => ({
  '--marquee-gap': '0.75rem',
  animationDuration: `${(onWorkflows.value ? workflows.length : providers.length) * SECONDS_PER_CARD}s`
}))

const copies = ref<HTMLElement[]>([])
watch(onWorkflows, () => {
  for (const copy of copies.value)
    for (const animation of copy.getAnimations()) animation.currentTime = 0
})

const cardHref = (name: string) =>
  `${routes.workshop}${catalogSearch({ query: name })}`

const cardClass =
  'group/card bg-transparency-white-t4 relative flex h-44 w-48 shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-transparency-white-t8 px-5 text-center text-primary-warm-white transition-colors hover:border-transparency-white-t20 focus-visible:border-primary-comfy-yellow focus-visible:outline-none'
</script>

<template>
  <WorkshopGate>
    <section
      class="overflow-hidden py-16 lg:py-24"
      data-testid="model-discovery"
    >
      <div
        class="mx-auto flex max-w-3xl flex-col items-center px-6 text-center"
      >
        <p
          class="text-sm font-bold tracking-widest text-primary-comfy-yellow uppercase"
        >
          {{ t('modelDiscovery.label', locale) }}
        </p>
        <h2
          class="mt-4 text-3.5xl/tight font-light whitespace-pre-line text-primary-comfy-canvas lg:text-5xl"
        >
          {{ t('modelDiscovery.heading', locale) }}
        </h2>
        <p
          class="mt-4 max-w-xl text-sm font-light text-primary-comfy-canvas/80 lg:text-base/snug"
        >
          {{ t('modelDiscovery.subtitle', locale) }}
        </p>

        <!-- The catalogue's own control, taught here: whoever presses it on
          the way down already knows it when the page opens. -->
        <CatalogueTabs
          v-if="tabbed"
          v-model="tab"
          :tabs="TABS"
          :locale
          class="mt-8"
        />
      </div>

      <div class="mt-10 lg:mt-12" :aria-label="rowLabel" role="region">
        <div
          class="overflow-hidden mask-[linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]"
        >
          <div class="group flex w-max gap-3">
            <div
              v-for="copy in 2"
              ref="copies"
              :key="copy"
              class="flex shrink-0 animate-marquee gap-3 group-focus-within:paused group-hover:paused"
              :style="marqueeStyle"
              data-testid="discovery-marquee"
              :aria-hidden="copy === 2 ? 'true' : undefined"
            >
              <DiscoveryWorkflowCard
                v-for="workflow in workflowRow"
                :key="workflow.name"
                :workflow
                :href="workflow.href"
                :class="cardClass"
                :tabindex="copy === 2 ? -1 : undefined"
                data-testid="discovery-workflow"
              />
              <DiscoveryProviderCard
                v-for="provider in providerRow"
                :key="provider.name"
                :provider
                :href="cardHref(provider.name)"
                :class="cardClass"
                :tabindex="copy === 2 ? -1 : undefined"
                data-testid="discovery-provider"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-10 flex justify-center px-6 lg:mt-12">
        <Button as="a" :href="browseHref" variant="outline">
          {{ browseLabel }}
        </Button>
      </div>
    </section>
  </WorkshopGate>
</template>
