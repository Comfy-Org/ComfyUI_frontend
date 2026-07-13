<!--
  Full-screen Getting Started takeover shown to fresh users after signup. Sits
  over the canvas (toolbar stays visible), driven by the persistence-layer entry
  flag. The Templates tab launches the onboarding tour on a curated template;
  Import and Tutorials are placeholders.
-->
<template>
  <Teleport v-if="visible" to="body">
    <div
      ref="screenRef"
      class="fixed inset-0 z-2000 flex flex-col items-center justify-center bg-base-background px-8"
      role="dialog"
      :aria-label="t('onboardingTour.gettingStarted.screenLabel')"
      tabindex="-1"
    >
      <div class="flex w-full max-w-5xl flex-col items-center">
        <h1 class="text-center text-3xl font-semibold text-base-foreground">
          {{ t('onboardingTour.gettingStarted.title') }}
        </h1>
        <p class="mt-2 text-center text-sm text-muted-foreground">
          {{ t('onboardingTour.gettingStarted.subtitle') }}
        </p>

        <ToggleGroup
          v-model="activeTab"
          type="single"
          class="mt-8"
          :aria-label="t('onboardingTour.gettingStarted.tabsLabel')"
        >
          <ToggleGroupItem
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
          >
            <i :class="cn(tab.icon, 'mr-2 size-3.5')" aria-hidden="true" />
            {{ t(tab.labelKey) }}
          </ToggleGroupItem>
        </ToggleGroup>

        <div class="mt-6 w-full">
          <div v-if="activeTab === 'templates'" class="flex gap-5">
            <GettingStartedTemplateCard
              v-for="template in cards"
              :key="template.name"
              :template
              class="min-w-0 flex-1"
              @select="onSelectTemplate"
            />
            <CardContainer
              variant="ghost"
              rounded="lg"
              role="button"
              tabindex="0"
              data-testid="getting-started-start-from-scratch"
              :aria-label="t('onboardingTour.gettingStarted.startFromScratch')"
              class="focus-visible:ring-ring min-w-0 flex-1 hover:bg-node-component-surface focus-visible:ring-1 focus-visible:outline-none"
              @click="onStartFromScratch"
              @keydown.enter.prevent="onStartFromScratch"
              @keydown.space.prevent="onStartFromScratch"
            >
              <template #top>
                <CardTop ratio="square">
                  <div
                    class="flex size-full items-center justify-center rounded-lg border border-border-default"
                  >
                    <i
                      class="icon-[lucide--plus] size-7 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </CardTop>
              </template>
              <template #bottom>
                <CardBottom>
                  <h3
                    class="m-0 line-clamp-1 pt-3 text-sm text-base-foreground"
                  >
                    {{ t('onboardingTour.gettingStarted.startFromScratch') }}
                  </h3>
                </CardBottom>
              </template>
            </CardContainer>
          </div>

          <p
            v-else
            data-testid="getting-started-placeholder"
            class="py-16 text-center text-sm text-muted-foreground"
          >
            {{ placeholderCopy }}
          </p>
        </div>

        <button
          type="button"
          data-testid="getting-started-discover-all"
          class="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-base-foreground"
          @click="onDiscoverAll"
        >
          {{ t('onboardingTour.gettingStarted.discoverAll') }}
          <i class="icon-[lucide--arrow-right] size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useOnboardingEntryStore } from '@/platform/workflow/persistence/onboardingEntryStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

import GettingStartedTemplateCard from './GettingStartedTemplateCard.vue'
import { useOnboardingTourController } from './useOnboardingTourController'

const CURATED_TEMPLATE_IDS = [
  'image_krea2_turbo_t2i',
  'image_z_image_turbo',
  'video_ltx2_3_i2v',
  'video_wan2_2_14B_i2v'
]

type TabValue = 'templates' | 'import' | 'tutorials'

const tabs = [
  {
    value: 'templates' as const,
    labelKey: 'onboardingTour.gettingStarted.tabs.templates',
    icon: 'icon-[lucide--layout-template]'
  },
  {
    value: 'import' as const,
    labelKey: 'onboardingTour.gettingStarted.tabs.import',
    icon: 'icon-[lucide--upload]'
  },
  {
    value: 'tutorials' as const,
    labelKey: 'onboardingTour.gettingStarted.tabs.tutorials',
    icon: 'icon-[lucide--tv-minimal-play]'
  }
]

const { t } = useI18n()

const entryStore = useOnboardingEntryStore()
const { shouldShowGettingStarted: visible } = storeToRefs(entryStore)

const templatesStore = useWorkflowTemplatesStore()
const { loadWorkflowTemplate } = useTemplateWorkflows()
const controller = useOnboardingTourController()

// ToggleGroup (single) writes back an empty value when the active item is
// toggled off, so the ref must admit `''` for the reset guard below to type-check.
const activeTab = ref<TabValue | ''>('templates')

const screenRef = useTemplateRef<HTMLElement>('screenRef')

const cards = computed(() =>
  CURATED_TEMPLATE_IDS.map((id) => templatesStore.getTemplateByName(id)).filter(
    (template) => template !== undefined
  )
)

const placeholderCopy = computed(() =>
  activeTab.value === 'import'
    ? t('onboardingTour.gettingStarted.placeholder.import')
    : t('onboardingTour.gettingStarted.placeholder.tutorials')
)

watch(activeTab, (value) => {
  if (!value) activeTab.value = 'templates'
})

watch(visible, (isVisible) => {
  if (isVisible) void nextTick(() => screenRef.value?.focus())
})

async function onSelectTemplate(id: string) {
  // Keep the screen up until the template loads, so a failed load leaves the
  // user here to pick again rather than stranded on a blank canvas.
  let loaded = false
  try {
    loaded = await loadWorkflowTemplate(id, 'default')
  } catch (error) {
    console.error('Failed to load onboarding template:', error)
  }
  if (!loaded) return
  entryStore.dismissGettingStarted()
  await controller.start(id)
}

function onStartFromScratch() {
  entryStore.dismissGettingStarted()
}

function onDiscoverAll() {
  entryStore.dismissGettingStarted()
  useWorkflowTemplateSelectorDialog().show('command', {
    initialCategory: 'basics-getting-started'
  })
}
</script>
