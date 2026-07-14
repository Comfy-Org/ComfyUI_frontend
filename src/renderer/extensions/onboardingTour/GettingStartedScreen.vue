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
        <div class="flex flex-col items-center gap-3">
          <h1
            class="text-center text-[2.5rem]/11 font-medium text-base-foreground"
          >
            {{ t('onboardingTour.gettingStarted.title') }}
          </h1>
          <p class="text-center text-base/5 text-muted-foreground">
            {{ t('onboardingTour.gettingStarted.subtitle') }}
          </p>
        </div>

        <TabList
          v-model="activeTab"
          class="mt-8 w-auto gap-1 rounded-full border border-white/10 p-0.5"
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

        <div class="mt-6 w-full">
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
              <GettingStartedTemplateCard
                v-for="template in cards"
                :key="template.name"
                :template
                :loading="loadingTemplateId === template.name"
                class="min-w-0"
                @select="onSelectTemplate"
              />
            </div>

            <p
              v-else
              data-testid="getting-started-placeholder"
              class="py-16 text-center text-sm text-muted-foreground"
            >
              {{ placeholderCopy }}
            </p>
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
    if (!templatesStore.isLoaded) void templatesStore.loadWorkflowTemplates()
    void nextTick(() => screenRef.value?.focus())
  },
  { immediate: true }
)

const placeholderCopy = computed(() =>
  activeTab.value === 'import'
    ? t('onboardingTour.gettingStarted.placeholder.import')
    : t('onboardingTour.gettingStarted.placeholder.tutorials')
)

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
