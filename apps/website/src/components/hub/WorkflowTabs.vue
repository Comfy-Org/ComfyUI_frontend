<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useTablist } from '../../composables/useTablist'
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'

// A workflow that runs on Cloud has no catalogue model behind it, so it never
// reached the model page's tabs and its details ended up stacked under the
// form. This is the same row, for the pages that cannot borrow that one: the
// page opens on the thing to do, and how the workflow is built waits to be
// asked for.
// Whether there is a playground is told rather than inferred: a slot that
// renders nothing is still a slot, so asking the slots would draw the tab
// empty.
const { runs = true, locale = 'en' } = defineProps<{
  /** Whether anything on this page can run the workflow. */
  runs?: boolean
  locale?: Locale
}>()

type Section = 'playground' | 'details' | 'api'

const sections = computed<readonly Section[]>(() =>
  runs ? ['playground', 'details', 'api'] : ['details', 'api']
)
const sectionLabel: Record<Section, HubKey> = {
  playground: 'workshop.v2.workflow.tabRun',
  details: 'workshop.v2.workflow.tabAbout',
  api: 'workshop.model.tabs.api'
}

const activeSection = ref<Section>(runs ? 'playground' : 'details')
const { onKeydown } = useTablist(() => sections.value, activeSection)
</script>

<template>
  <div class="flex flex-col gap-10" data-testid="workflow-tabs">
    <div
      class="flex items-center gap-8 border-b border-transparency-white-t8 max-sm:gap-5"
    >
      <div
        role="tablist"
        :aria-label="tHub('workshop.v2.workflow.tabs', locale)"
        class="scrollbar-hide flex min-w-0 gap-8 overflow-x-auto max-sm:gap-5"
        @keydown="onKeydown"
      >
        <button
          v-for="section in sections"
          :id="`tab-${section}`"
          :key="section"
          type="button"
          role="tab"
          :aria-selected="section === activeSection"
          :aria-controls="`panel-${section}`"
          :tabindex="section === activeSection ? 0 : -1"
          :data-testid="`tab-${section}`"
          :class="
            cn(
              'cursor-pointer border-b-2 pb-3 text-sm font-bold tracking-wider uppercase transition-colors',
              section === activeSection
                ? 'border-primary-comfy-yellow text-primary-warm-white'
                : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
            )
          "
          @click="activeSection = section"
        >
          {{ tHub(sectionLabel[section], locale) }}
        </button>
      </div>
    </div>

    <section
      v-if="runs && activeSection === 'playground'"
      id="panel-playground"
      role="tabpanel"
      aria-labelledby="tab-playground"
      data-testid="playground-tab"
    >
      <slot name="playground" />
    </section>

    <section
      v-else-if="activeSection === 'details'"
      id="panel-details"
      role="tabpanel"
      aria-labelledby="tab-details"
      data-testid="details-tab"
    >
      <slot name="details" />
    </section>

    <section
      v-else
      id="panel-api"
      role="tabpanel"
      aria-labelledby="tab-api"
      data-testid="api-tab"
    >
      <slot name="api" />
    </section>
  </div>
</template>
