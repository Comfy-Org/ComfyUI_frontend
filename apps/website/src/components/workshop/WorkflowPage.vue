<script setup lang="ts">
import { ArrowUpRight, Cloud, Code, Download } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { useCaseFor } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { scrollToSection } from '@/lib/workshop/scroll-to-section'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'
import { t } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import { workshopModelAnalytics } from '@/scripts/workshop-analytics'
import CatalogueBackLink from './CatalogueBackLink.vue'
import HubBreadcrumb from './HubBreadcrumb.vue'
import WorkflowPlayground from './WorkflowPlayground.vue'

const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const emit = defineEmits<{ recovery: [active: boolean] }>()
const { session } = useWorkshopSession()
const scope = computed(() =>
  session.value
    ? JSON.stringify([session.value.uid, session.value.workspace.id])
    : 'anonymous'
)
const routes = getRoutes()

// The one thing the eyebrow can lead somewhere: the shelf this workflow sits
// on. It was a word before, and a word is not a way back.
const shelf = computed(() => {
  const useCase = useCaseFor(model)
  const category = model.category
  return useCase
    ? {
        label: useCaseLabelKey[useCase],
        href: category
          ? `${routes.hubWorkflows}?${new URLSearchParams({ category })}`
          : routes.hubWorkflows
      }
    : undefined
})
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
const secondaryPathClass =
  'px-5 font-bold tracking-wider text-primary-warm-white uppercase'

const crumbs = [
  { label: t('workshop.catalogue.eyebrow'), href: routes.hubExplore },
  { label: t('workshop.hub.workflows'), href: routes.hubWorkflows },
  { label: model.name }
]

const template = model.workflow.template
const cloudHref = template
  ? `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(template.id)}`
  : undefined

const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
function goTo(event: MouseEvent, id: string) {
  if (!document.getElementById(id)) return
  event.preventDefault()
  scrollToSection(id)
  history.replaceState(history.state, '', `#${id}`)
}

function captureDownload() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'workflow_download_clicked',
      properties: workshopModelAnalytics(model)
    })
}
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <div
      class="mb-7 flex min-h-11 items-center justify-between gap-6"
      data-testid="workflow-back-row"
    >
      <CatalogueBackLink
        :catalogue="routes.hubWorkflows"
        :fallback="t('workshop.catalogue.backToWorkflows')"
      />
      <HubBreadcrumb :crumbs class="max-sm:hidden" />
    </div>
    <header class="mb-12" data-testid="workflow-hero">
      <div v-if="shelf" class="mb-3 flex flex-wrap items-center gap-3">
        <a
          :href="shelf.href"
          :class="pillClass"
          data-testid="workflow-use-case"
          >{{ t(shelf.label) }}</a
        >
      </div>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ model.name }}
      </h1>
      <p
        v-if="model.summary"
        class="mt-4 max-w-3xl text-lg text-primary-warm-gray"
      >
        {{ model.summary }}
      </p>
      <nav
        :aria-label="t('workshop.workflow.paths')"
        class="mt-6 flex flex-wrap items-center gap-2"
        data-testid="workflow-paths"
      >
        <Button
          v-if="template?.downloadUrl"
          as="a"
          :href="template.downloadUrl"
          download
          class="px-5"
          data-testid="workflow-path-download"
          @click="captureDownload"
        >
          <Download class="size-4" aria-hidden="true" />
          {{ t('workshop.workflow.downloadWorkflow') }}
        </Button>
        <Button
          v-if="cloudHref"
          as="a"
          :href="cloudHref"
          target="_blank"
          rel="noopener"
          variant="ghost"
          :class="secondaryPathClass"
          data-testid="workflow-path-cloud"
        >
          <Cloud class="size-4" aria-hidden="true" />
          {{ t('workshop.workflow.runInCloud') }}
          <ArrowUpRight class="size-3.5 opacity-70" aria-hidden="true" />
          <span class="sr-only">{{
            t('workshop.workflow.opensInNewTab')
          }}</span>
        </Button>
        <Button
          as="a"
          href="#api"
          variant="ghost"
          :class="secondaryPathClass"
          data-testid="workflow-path-api"
          @click="goTo($event, 'api')"
        >
          <Code class="size-4" aria-hidden="true" />
          {{ t('workshop.workflow.apiPath') }}
        </Button>
      </nav>
    </header>

    <WorkflowPlayground
      :key="scope"
      :model="model"
      :scope="scope"
      :cloud-href="cloudHref"
      @recovery="emit('recovery', $event)"
    />
  </div>
</template>
