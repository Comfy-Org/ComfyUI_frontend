<script setup lang="ts">
import { Box, UserRound } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

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

const {
  model,
  cloudHref,
  standalone = false,
  active = true
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  cloudHref?: string
  standalone?: boolean
  /** Whether this tab is showing; the graph waits until it first is. */
  active?: boolean
}>()
const t = computed(
  () => translationsFor(model.catalogDetails?.locale ?? 'en').t
)
const catalogModels = computed(() =>
  model.catalogDetails?.models.filter((item) => item.name.trim())
)

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
const files = computed(() => model.catalogDetails?.workflowFiles)
const selectedFile = ref<string>()
const downloadHref = computed(() =>
  files.value
    ? (files.value.find((file) => file.href === selectedFile.value)?.href ??
      files.value.at(-1)?.href)
    : template.value?.downloadUrl
)
watch(
  () => model.slug,
  () => {
    selectedFile.value = undefined
  }
)
function selectFile(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const value = event.target.value
  const file = files.value?.find((item) => item.href === value)
  selectedFile.value = file?.href
}
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
  const perRun = t.value('workshop.workflow.perRun', {
    count: outputs.length
  })
  const kinds = new Set(outputs.map((output) => output.kind))
  const only = kinds.size === 1 ? [...kinds][0] : undefined
  const label = only ? OUTPUT_LABEL[only] : undefined
  return label ? `${t.value(label)}, ${perRun}` : perRun
})

const facts = computed(() => {
  if (model.catalogDetails) {
    const details = model.catalogDetails
    const rows: { label: TranslationKey; value: string }[] = []
    if (typeof details.worksOnCloud === 'boolean')
      rows.push({
        label: 'cccWorkflow.cloud',
        value: t.value(
          details.worksOnCloud ? 'cccWorkflow.yes' : 'cccWorkflow.no'
        )
      })
    if (details.outputType)
      rows.push({
        label: 'workshop.workflow.factOutput',
        value: t.value(`cccWorkflow.output.${details.outputType}`)
      })
    if (details.author?.trim())
      rows.push({
        label: 'workshop.workflow.factAuthor',
        value: details.author
      })
    for (const field of ['runs', 'downloads'] as const) {
      const value = details[field]
      if (typeof value === 'number')
        rows.push({
          label: `cccWorkflow.${field}`,
          value: value.toLocaleString(details.locale)
        })
    }
    return rows
  }
  const rows: { label: TranslationKey; value: string }[] = [
    {
      label: 'workshop.workflow.factWhere',
      value: t.value(
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
  <section
    id="workflow-panel-workflow"
    :role="standalone ? undefined : 'tabpanel'"
    :aria-labelledby="standalone ? undefined : 'workflow-tab-workflow'"
  >
    <SectionHeading
      v-if="!standalone"
      class="mb-8"
      :title="t('workshop.workflow.inside')"
      :subtitle="t('workshop.workflow.previewHint')"
    />

    <div
      :class="
        standalone
          ? 'grid gap-8 lg:grid-cols-[22.5rem_minmax(0,1fr)] lg:gap-16'
          : 'grid gap-10 lg:grid-cols-12'
      "
    >
      <div :class="standalone ? 'min-w-0 lg:order-2' : 'lg:col-span-8'">
        <WorkflowGraph
          v-if="downloadHref"
          :key="downloadHref"
          :source="downloadHref"
          :samples
          :fallback="files ? undefined : template?.previewUrl"
          :full-href="files ? downloadHref : template?.previewUrl"
          :active
        />
        <a
          v-else-if="!files && template?.previewUrl"
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

      <div :class="standalone ? 'min-w-0 lg:order-1' : 'lg:col-span-4'">
        <div class="flex flex-col gap-4 lg:sticky lg:top-24">
          <div class="flex flex-col gap-3" data-testid="workflow-actions">
            <Button
              v-if="cloudHref && model.catalogDetails?.worksOnCloud !== false"
              as="a"
              :href="cloudHref"
              target="_blank"
              rel="noopener"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              @click="captureTryInCloud"
              >{{ t('workshop.workflow.tryCloud') }}</Button
            >
            <Button
              v-if="downloadHref"
              as="a"
              :href="downloadHref"
              :download="`${model.slug.split('/').pop()}.json`"
              variant="outline"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              @click="captureWorkflowDownload"
              >{{ t('workshop.workflow.download') }}</Button
            >
            <label
              v-if="files && files.length > 1"
              class="grid gap-2 text-sm text-primary-warm-gray"
            >
              {{ t('cccWorkflow.version') }}
              <select
                :value="downloadHref"
                class="min-h-11 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-primary-comfy-canvas"
                @change="selectFile"
              >
                <option
                  v-for="file in files"
                  :key="file.href"
                  :value="file.href"
                >
                  {{ file.name }}
                </option>
              </select>
            </label>
            <Button
              v-if="model.catalogDetails?.documentationURL"
              as="a"
              :href="model.catalogDetails.documentationURL"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              >{{ t('workshop.workflow.apiDocs') }}</Button
            >
          </div>

          <div
            v-if="
              facts.length ||
              (catalogModels ? catalogModels.length : template?.models.length)
            "
            class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
            data-testid="workflow-facts"
          >
            <section
              v-if="
                catalogModels ? catalogModels.length : template?.models.length
              "
              class="px-5 py-4"
              data-testid="workflow-runs-on"
            >
              <h3
                class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
              >
                {{ t('workshop.workflow.runsOn') }}
              </h3>
              <ul class="mt-2 flex flex-col gap-1">
                <li
                  v-for="item in catalogModels ??
                  template?.models.map((name) => ({
                    uid: name,
                    name,
                    href: undefined
                  })) ??
                  []"
                  :key="item.uid"
                  class="flex items-center gap-2.5 py-1.5"
                >
                  <Box
                    class="size-4 shrink-0 text-primary-warm-gray"
                    aria-hidden="true"
                  />
                  <a
                    v-if="item.href"
                    :href="item.href"
                    class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas underline underline-offset-4 hover:text-primary-comfy-yellow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-comfy-yellow"
                    >{{ item.name }}</a
                  >
                  <span
                    v-else
                    class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
                    >{{ item.name }}</span
                  >
                </li>
              </ul>
            </section>

            <section
              v-if="facts.length"
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
                    <span
                      v-if="fact.label === 'workshop.workflow.factAuthor'"
                      class="flex items-center gap-2"
                    >
                      <img
                        v-if="model.catalogDetails?.authorAvatarURL"
                        :src="model.catalogDetails.authorAvatarURL"
                        alt=""
                        class="size-6 shrink-0 rounded-full object-cover"
                        referrerpolicy="no-referrer"
                      />
                      <UserRound
                        v-else
                        class="size-6 shrink-0 text-primary-warm-gray"
                        aria-hidden="true"
                      />
                      <span class="truncate">{{ fact.value }}</span>
                    </span>
                    <template v-else>{{ fact.value }}</template>
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
