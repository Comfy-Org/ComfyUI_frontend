<script setup lang="ts">
import { Cloud, Code, Download } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { pagePaths } from '@/lib/workshop/page-paths'
import { scrollToSection } from '@/lib/workshop/scroll-to-section'
import { t } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import { workshopModelAnalytics } from '@/scripts/workshop-analytics'
import DetailTrail from './DetailTrail.vue'
import WorkflowMoreLikeThis from './WorkflowMoreLikeThis.vue'
import WorkflowPlayground from './WorkflowPlayground.vue'
import WorkflowPreview from './WorkflowPreview.vue'

const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const emit = defineEmits<{ recovery: [active: boolean] }>()
const { session } = useWorkshopSession()
const scope = computed(() =>
  session.value
    ? JSON.stringify([session.value.uid, session.value.workspace.id])
    : 'anonymous'
)
const paths = pagePaths(model)

const secondaryPathClass =
  'px-5 font-bold tracking-wider text-primary-warm-white uppercase'

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

function captureTryInCloud() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'try_in_cloud_clicked',
      properties: workshopModelAnalytics(model)
    })
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
      class="mb-7 flex min-h-11 items-center"
      data-testid="workflow-back-row"
    >
      <DetailTrail section="workflows" :name="model.name" />
    </div>
    <header class="mb-12" data-testid="workflow-hero">
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
          v-if="cloudHref"
          as="a"
          :href="cloudHref"
          target="_blank"
          rel="noopener"
          variant="outline"
          class="px-5"
          data-testid="workflow-path-cloud"
          @click="captureTryInCloud"
        >
          <template #prepend>
            <Cloud class="size-4" aria-hidden="true" />
          </template>
          {{ t('workshop.workflow.runInCloud') }}
          <span class="sr-only">{{
            t('workshop.workflow.opensInNewTab')
          }}</span>
        </Button>
        <Button
          v-if="template?.downloadUrl"
          as="a"
          :href="template.downloadUrl"
          download
          variant="outline"
          class="px-5"
          data-testid="workflow-path-download"
          @click="captureDownload"
        >
          <template #prepend>
            <Download class="size-4" aria-hidden="true" />
          </template>
          {{ t('workshop.workflow.downloadWorkflow') }}
        </Button>
        <Button
          v-if="paths.api"
          as="a"
          href="#api"
          variant="ghost"
          :class="secondaryPathClass"
          data-testid="workflow-path-api"
          @click="goTo($event, 'api')"
        >
          <template #prepend>
            <Code class="size-4" aria-hidden="true" />
          </template>
          {{ t('workshop.workflow.apiPath') }}
        </Button>
      </nav>
    </header>

    <WorkflowPlayground
      v-if="paths.run"
      :key="scope"
      :model="model"
      :scope="scope"
      @recovery="emit('recovery', $event)"
    />
    <div
      v-else
      id="workflow"
      class="scroll-mt-28"
      data-testid="workflow-inside"
    >
      <WorkflowPreview :model />
    </div>
    <WorkflowMoreLikeThis
      :model
      class="mt-16 border-t border-transparency-white-t8 pt-12"
    />
  </div>
</template>
