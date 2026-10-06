<script setup lang="ts">
import { Box, FileBox } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import { workshopModelAnalytics } from '@/scripts/workshop-analytics'
import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'

const { t } = translationsFor('en')
const {
  model,
  cloudHref,
  active = true
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  cloudHref?: string
  /** Whether the section has been reached; the graph waits until it is. */
  active?: boolean
}>()

const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const modelAnalytics = workshopModelAnalytics(model)

function captureTryInCloud() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'try_in_cloud_clicked',
      properties: modelAnalytics
    })
}

function captureWorkflowDownload() {
  if (enabled.value && workflowsEnabled.value)
    captureWorkshopEvent({
      name: 'workflow_download_clicked',
      properties: modelAnalytics
    })
}

const template = computed(() => model.workflow.template)
const GROUP_HEADING =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
const ROW =
  'group flex items-center gap-2.5 rounded-lg py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
const LINK_TEXT = 'transition-colors group-hover:text-primary-comfy-yellow'
// What the workflow makes, hung in the node that hands it back. The samples
// beneath it are results too, so there is no before to hang at the way in, and
// a node cannot play a video.
const samples = computed(() =>
  model.thumbnail?.kind === 'image' ? [model.thumbnail.url] : []
)

const OUTPUT_LABEL: Record<string, TranslationKey> = {
  image: 'workshop.task.image',
  video: 'workshop.task.video',
  audio: 'workshop.task.audio'
}

// What a run gives back. Naming the medium only where every output is the same
// one, because a mixed set has no single name and a count on its own is still
// true.
const produces = computed(() => {
  const outputs = model.workflow.outputs ?? []
  if (!outputs.length) return undefined
  const perRun = t('workshop.workflow.perRun', {
    count: outputs.length
  })
  const kinds = new Set(outputs.map((output) => output.kind))
  const only = kinds.size === 1 ? [...kinds][0] : undefined
  const label = only ? OUTPUT_LABEL[only] : undefined
  return label ? `${t(label)}, ${perRun}` : perRun
})

const runsOn = computed(
  () =>
    model.parts?.runsOn ??
    (template.value?.models ?? []).map((name) => ({ name, href: undefined }))
)
const files = computed(() => model.parts?.files ?? [])

const FILE_TYPE: Partial<Record<string, TranslationKey>> = {
  checkpoints: 'workshop.workflow.fileType.checkpoint',
  diffusion_models: 'workshop.workflow.fileType.diffusionModel',
  loras: 'workshop.workflow.fileType.lora',
  vae: 'workshop.workflow.fileType.vae',
  text_encoders: 'workshop.workflow.fileType.textEncoder',
  clip_vision: 'workshop.workflow.fileType.clipVision',
  controlnet: 'workshop.workflow.fileType.controlnet',
  upscale_models: 'workshop.workflow.fileType.upscaler',
  latent_upscale_models: 'workshop.workflow.fileType.upscaler',
  audio_encoders: 'workshop.workflow.fileType.audioEncoder',
  background_removal: 'workshop.workflow.fileType.backgroundRemoval'
}

function fileType(directory: string | undefined) {
  const key = directory ? FILE_TYPE[directory] : undefined
  return key ? t(key) : undefined
}

const facts = computed(() => {
  const rows: { label: TranslationKey; value: string }[] = [
    {
      label: 'workshop.workflow.factWhere',
      value: t(
        model.type === 'CLOUD'
          ? 'workshop.workflow.runsCloud'
          : 'workshop.workflow.runsOwn'
      )
    }
  ]
  if (produces.value)
    rows.push({
      label: 'workshop.workflow.factOutput',
      value: produces.value
    })
  if (model.author)
    rows.push({ label: 'workshop.workflow.factAuthor', value: model.author })
  return rows
})
</script>

<template>
  <section aria-labelledby="workflow-inside-heading">
    <SectionHeading
      class="mb-8"
      title-id="workflow-inside-heading"
      :title="t('workshop.workflow.inside')"
      :subtitle="t('workshop.workflow.previewHint')"
    />

    <div class="grid gap-10 lg:grid-cols-12">
      <div class="lg:col-span-8">
        <WorkflowGraph
          v-if="template?.downloadUrl"
          :key="model.slug"
          :source="template.downloadUrl"
          :samples
          :fallback="template.previewUrl"
          :full-href="template.previewUrl"
          :active
        />
        <a
          v-else-if="template?.previewUrl"
          :href="template.previewUrl"
          target="_blank"
          rel="noopener"
          :aria-label="t('workshop.workflow.fullPreview')"
          class="block overflow-hidden rounded-2xl border border-transparency-white-t8 focus-visible:outline-primary-comfy-yellow"
        >
          <img
            :src="template.previewUrl"
            :alt="t('workshop.workflow.graph')"
            loading="lazy"
            class="max-h-160 w-full object-contain"
          />
        </a>
      </div>

      <div class="lg:col-span-4">
        <div class="flex flex-col gap-4 lg:sticky lg:top-24">
          <div class="flex flex-col gap-3" data-testid="workflow-actions">
            <Button
              v-if="cloudHref"
              as="a"
              :href="cloudHref"
              target="_blank"
              rel="noopener"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              @click="captureTryInCloud"
              >{{ t('workshop.workflow.tryCloud') }}</Button
            >
            <Button
              v-if="template?.downloadUrl"
              as="a"
              :href="template.downloadUrl"
              download
              variant="outline"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              @click="captureWorkflowDownload"
              >{{ t('workshop.workflow.download') }}</Button
            >
          </div>

          <div
            class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
            data-testid="workflow-facts"
          >
            <section
              v-if="runsOn.length"
              class="px-5 py-4"
              data-testid="workflow-runs-on"
            >
              <h3 :class="GROUP_HEADING">
                {{ t('workshop.workflow.runsOn') }}
              </h3>
              <ul class="mt-2 flex flex-col gap-1">
                <li v-for="part in runsOn" :key="part.name">
                  <component
                    :is="part.href ? 'a' : 'div'"
                    :href="part.href"
                    :class="ROW"
                  >
                    <Box
                      class="size-4 shrink-0 text-primary-warm-gray"
                      aria-hidden="true"
                    />
                    <span
                      :class="
                        cn(
                          'min-w-0 flex-1 truncate text-base text-primary-comfy-canvas',
                          part.href && LINK_TEXT
                        )
                      "
                    >
                      {{ part.name }}
                    </span>
                  </component>
                </li>
              </ul>
            </section>

            <section
              v-if="files.length"
              class="border-t border-transparency-white-t8 px-5 py-4 first:border-t-0"
              data-testid="workflow-files"
            >
              <h3 :class="GROUP_HEADING">
                {{ t('workshop.workflow.filesNeeded') }}
              </h3>
              <p class="mt-1 text-xs text-primary-warm-gray">
                {{ t('workshop.workflow.filesNote') }}
              </p>
              <ul class="mt-2 flex flex-col gap-1">
                <li v-for="file in files" :key="file.name">
                  <component
                    :is="file.href ? 'a' : 'div'"
                    :href="file.href"
                    :class="ROW"
                  >
                    <FileBox
                      class="size-4 shrink-0 text-primary-warm-gray"
                      aria-hidden="true"
                    />
                    <span
                      :class="
                        cn(
                          'min-w-0 flex-1 truncate text-sm text-primary-comfy-canvas',
                          file.href && LINK_TEXT
                        )
                      "
                    >
                      {{ file.name }}
                    </span>
                    <span
                      v-if="fileType(file.directory)"
                      class="shrink-0 text-xs text-primary-warm-gray"
                    >
                      {{ fileType(file.directory) }}
                    </span>
                  </component>
                </li>
              </ul>
            </section>

            <section
              class="border-t border-transparency-white-t8 px-5 py-4 first:border-t-0"
              data-testid="workflow-details"
            >
              <dl class="flex flex-col gap-1 text-sm">
                <div
                  v-for="fact in facts"
                  :key="fact.label"
                  class="grid grid-cols-[6rem_1fr] gap-4"
                >
                  <dt class="text-primary-warm-gray">{{ t(fact.label) }}</dt>
                  <dd
                    class="min-w-0 truncate text-primary-comfy-canvas tabular-nums"
                  >
                    {{ fact.value }}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
