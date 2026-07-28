<template>
  <Teleport to="body">
    <FocusScope as-child trapped loop>
      <div
        ref="screenRef"
        class="fixed inset-0 z-2000 flex overflow-y-auto bg-base-background focus:outline-none"
        role="dialog"
        aria-modal="true"
        :aria-label="t('gettingStarted.title')"
        tabindex="-1"
        @keydown.escape.capture.prevent="dismissGettingStarted()"
      >
        <div class="m-auto flex w-full flex-col items-center gap-8 px-8 py-16">
          <div class="flex flex-col items-center gap-3">
            <h1
              class="m-0 text-center text-4xl/11 font-medium text-base-foreground"
            >
              {{ t('gettingStarted.title') }}
            </h1>
            <p class="m-0 text-center text-base/5 text-muted-foreground">
              {{ t('gettingStarted.subtitle') }}
            </p>
          </div>

          <TabList
            v-model="activeTab"
            class="w-auto gap-1 rounded-full border border-border-subtle p-0.5"
            :aria-label="t('gettingStarted.tabsLabel')"
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

          <div class="w-full max-w-5xl">
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
                    :failed="failedTemplateId === template.name"
                    class="min-w-0"
                    @select="onSelectTemplate"
                  />
                </template>
                <div
                  v-else-if="catalogFailed"
                  class="col-span-full flex flex-col items-center gap-4 py-16"
                >
                  <p class="m-0 text-center text-sm text-muted-foreground">
                    {{ t('gettingStarted.loadFailed') }}
                  </p>
                  <Button
                    variant="secondary"
                    data-testid="getting-started-retry-catalog"
                    @click="loadCatalog"
                  >
                    {{ t('gettingStarted.retry') }}
                  </Button>
                </div>
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
                v-else
                class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
              >
                <GettingStartedCard
                  v-for="(tutorial, index) in tutorialCards"
                  :key="tutorial.id"
                  :image-src="
                    tutorialThumbnail(tutorial.thumbnailTemplate, index)
                  "
                  :title="t(tutorial.titleKey)"
                  :badge-icon="TUTORIAL_BADGE_ICON"
                  :testid="`getting-started-tutorial-${tutorial.id}`"
                  class="min-w-0"
                  @select="openTutorial(tutorial.url)"
                />
              </div>
            </TabPanel>
          </div>

          <Button
            variant="muted-textonly"
            data-testid="getting-started-blank"
            @click="dismissGettingStarted()"
          >
            {{ t('gettingStarted.startBlank') }}
          </Button>
        </div>
      </div>
    </FocusScope>
  </Teleport>
</template>

<script setup lang="ts">
import { FocusScope } from 'reka-ui'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import TabPanel from '@/components/tab/TabPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

import GettingStartedCard from './GettingStartedCard.vue'
import GettingStartedTemplateCard from './GettingStartedTemplateCard.vue'
import { useFirstRunEntry } from './firstRunEntry'
import type { TutorialCard } from './tutorialCards'
import {
  CURATED_TEMPLATE_IDS,
  FALLBACK_TEMPLATE_IDS,
  TUTORIAL_BADGE_ICON,
  tutorialCards
} from './tutorialCards'

type TabValue = 'templates' | 'tutorials'

const tabs = [
  {
    value: 'templates' as const,
    labelKey: 'gettingStarted.tabs.templates',
    icon: 'icon-[lucide--layout-template]'
  },
  {
    value: 'tutorials' as const,
    labelKey: 'gettingStarted.tabs.tutorials',
    icon: 'icon-[lucide--tv-minimal-play]'
  }
]

const { t } = useI18n()

const { dismissGettingStarted } = useFirstRunEntry()
const templatesStore = useWorkflowTemplatesStore()
const { loadWorkflowTemplate, getTemplateThumbnailUrl, loadingTemplateId } =
  useTemplateWorkflows()

const activeTab = ref<TabValue>('templates')
const failedTemplateId = ref<string | null>(null)
const catalogFailed = ref(false)

const screenRef = useTemplateRef<HTMLElement>('screenRef')

function resolveTemplates(ids: readonly string[]) {
  return ids
    .map((id) => templatesStore.getTemplateByName(id))
    .filter((template) => template !== undefined)
}

/** Tops the grid back up to its skeleton count when curated data is incomplete. */
const cards = computed(() => {
  const curated = resolveTemplates(CURATED_TEMPLATE_IDS)
  const chosen = new Set(curated.map((template) => template.name))
  const backfill = resolveTemplates(FALLBACK_TEMPLATE_IDS).filter(
    (template) => !chosen.has(template.name)
  )
  return [...curated, ...backfill].slice(0, CURATED_TEMPLATE_IDS.length)
})

async function loadCatalog() {
  catalogFailed.value = false
  await templatesStore.loadWorkflowTemplates()
  catalogFailed.value = !templatesStore.isLoaded
}

// Nothing else loads the catalog on this path, so load it (and take focus) on open.
onMounted(() => {
  if (!templatesStore.isLoaded) void loadCatalog()
  void nextTick(() => screenRef.value?.focus())
})

function tutorialThumbnail(
  id: TutorialCard['thumbnailTemplate'],
  index: number
) {
  const fallbacks = cards.value
  const template =
    templatesStore.getTemplateByName(id) ??
    (fallbacks.length ? fallbacks[index % fallbacks.length] : undefined)
  return template ? getTemplateThumbnailUrl(template, 'default') : ''
}

function openTutorial(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function onSelectTemplate(id: string) {
  if (loadingTemplateId.value) return
  failedTemplateId.value = null

  if (await loadWorkflowTemplate(id, 'default')) {
    await dismissGettingStarted()
    return
  }

  failedTemplateId.value = id
  useToastStore().add({
    severity: 'error',
    summary: t('g.error'),
    detail: t('gettingStarted.templateFailed')
  })
}
</script>
