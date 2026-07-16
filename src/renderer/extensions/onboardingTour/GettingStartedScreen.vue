<template>
  <Teleport v-if="visible" to="body">
    <div
      ref="screenRef"
      class="fixed inset-0 z-2000 flex flex-col items-center justify-center bg-base-background px-8 focus:outline-none"
      role="dialog"
      :aria-label="t('onboardingTour.gettingStarted.screenLabel')"
      tabindex="-1"
    >
      <div class="flex w-full max-w-5xl flex-col items-center gap-8">
        <div class="flex flex-col items-center gap-3">
          <h1
            class="m-0 text-center text-[2.5rem]/11 font-medium text-base-foreground"
          >
            {{ t('onboardingTour.gettingStarted.title') }}
          </h1>
          <p class="m-0 text-center text-base/5 text-muted-foreground">
            {{ t('onboardingTour.gettingStarted.subtitle') }}
          </p>
        </div>

        <TabList
          v-model="activeTab"
          class="w-auto gap-1 rounded-full border border-border-subtle p-0.5"
          :aria-label="t('onboardingTour.gettingStarted.tabsLabel')"
        >
          <Tab
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            class="gap-2.5 rounded-full px-3 text-xs font-medium text-base-foreground hover:opacity-100 data-[state=active]:bg-tertiary-background data-[state=inactive]:opacity-70"
          >
            <i :class="cn(tab.icon, 'size-3.5')" aria-hidden="true" />
            {{ t(tab.labelKey) }}
          </Tab>
        </TabList>

        <div class="w-full">
          <TabPanel
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            :model-value="activeTab"
          >
            <div
              v-if="tab.value === 'templates'"
              class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
            >
              <template v-if="templatesStore.isLoaded">
                <GettingStartedTemplateCard
                  v-for="template in cards"
                  :key="template.name"
                  :template
                  :loading="loadingTemplateId === template.name"
                  class="min-w-0"
                  @select="onSelectTemplate"
                />
              </template>
              <template v-else>
                <GettingStartedCard
                  v-for="id in CURATED_TEMPLATE_IDS"
                  :key="id"
                  skeleton
                  testid="getting-started-card-skeleton"
                  class="min-w-0"
                />
              </template>
            </div>

            <div
              v-else-if="tab.value === 'tutorials'"
              class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
            >
              <GettingStartedCard
                v-for="tutorial in tutorialCards"
                :key="tutorial.id"
                :image-src="tutorialThumbnail(tutorial.thumbnailTemplate)"
                :title="t(tutorial.titleKey)"
                :badge-icon="TUTORIAL_BADGE_ICON"
                :testid="`getting-started-tutorial-${tutorial.id}`"
                class="min-w-0"
                @select="openTutorial(tutorial.url)"
              />
            </div>
          </TabPanel>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import TabPanel from '@/components/tab/TabPanel.vue'
import { useOnboardingEntryStore } from '@/platform/workflow/persistence/onboardingEntryStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

import GettingStartedCard from './GettingStartedCard.vue'
import GettingStartedTemplateCard from './GettingStartedTemplateCard.vue'
import type { TutorialCard } from './tutorialCards'
import {
  CURATED_TEMPLATE_IDS,
  TUTORIAL_BADGE_ICON,
  tutorialCards
} from './tutorialCards'
import { useOnboardingTourController } from './useOnboardingTourController'

type TabValue = 'templates' | 'tutorials'

const tabs = [
  {
    value: 'templates' as const,
    labelKey: 'onboardingTour.gettingStarted.tabs.templates',
    icon: 'icon-[lucide--layout-template]'
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
const { loadWorkflowTemplate, getTemplateThumbnailUrl } = useTemplateWorkflows()
const controller = useOnboardingTourController()

const activeTab = ref<TabValue>('templates')
const loadingTemplateId = ref<string | null>(null)

const screenRef = useTemplateRef<HTMLElement>('screenRef')

const cards = computed(() =>
  CURATED_TEMPLATE_IDS.map((id) => templatesStore.getTemplateByName(id)).filter(
    (template) => template !== undefined
  )
)

// Cards and per-card loads no-op until the templates store is loaded; nothing
// else loads it on this path, so load it (and focus the takeover) on open.
watch(
  visible,
  (isVisible) => {
    if (!isVisible) return
    if (!templatesStore.isLoaded) {
      templatesStore.loadWorkflowTemplates().catch((error: unknown) => {
        console.error('Failed to load onboarding templates:', error)
      })
    }
    void nextTick(() => screenRef.value?.focus())
  },
  { immediate: true }
)

function tutorialThumbnail(id: TutorialCard['thumbnailTemplate']) {
  const template = templatesStore.getTemplateByName(id)
  return template ? getTemplateThumbnailUrl(template, 'default') : ''
}

function openTutorial(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function onSelectTemplate(id: string) {
  if (loadingTemplateId.value) return
  // Keep the screen up (the card shows a spinner) through the load and the
  // tour's readiness gate: a failed load leaves the user here to pick again,
  // and the tour overlay takes over on top before the screen is dismissed, so
  // the canvas never flashes bare.
  loadingTemplateId.value = id
  try {
    let loaded = false
    try {
      loaded = await loadWorkflowTemplate(id, 'default')
    } catch (error) {
      console.error('Failed to load onboarding template:', error)
    }
    if (!loaded) return
    try {
      await controller.beginTour({ templateId: id })
      entryStore.dismissGettingStarted()
    } catch (error) {
      // Keep the screen up so the user can retry rather than landing on a
      // half-started tour behind a dismissed takeover.
      console.error('Failed to start onboarding tour:', error)
    }
  } finally {
    loadingTemplateId.value = null
  }
}
</script>
