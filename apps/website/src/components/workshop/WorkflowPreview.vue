<script setup lang="ts">
import { Box } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import type { TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { model, cloudHref } = defineProps<{
  model: WorkflowWorkshopModelDetail
  cloudHref?: string
}>()

const template = model.workflow.template

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
  const perRun = t('workshop.workflow.perRun').replace(
    '{count}',
    String(outputs.length)
  )
  const kinds = new Set(outputs.map((output) => output.kind))
  const only = kinds.size === 1 ? [...kinds][0] : undefined
  const label = only ? OUTPUT_LABEL[only] : undefined
  return label ? `${t(label)}, ${perRun}` : perRun
})

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

const sectionTitle =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const band = 'border-t border-transparency-white-t8 px-5 py-4 first:border-t-0'
const bandHeading =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <section
    id="workflow-panel-workflow"
    role="tabpanel"
    aria-labelledby="workflow-tab-workflow"
  >
    <!-- The heading spans both columns, so the graph and the column beside it
      start on the same line rather than one hanging below the other. -->
    <div class="mb-8">
      <h2 :class="sectionTitle">{{ t('workshop.workflow.inside') }}</h2>
      <p class="mt-2 text-sm/relaxed text-primary-warm-gray">
        {{ t('workshop.workflow.previewHint') }}
      </p>
    </div>

    <div class="grid gap-10 lg:grid-cols-12">
      <div class="lg:col-span-8" data-testid="workflow-graph-section">
        <a
          v-if="template?.previewUrl"
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
        <div class="flex flex-col gap-4 lg:sticky lg:top-28">
          <div class="flex flex-col gap-3" data-testid="workflow-actions">
            <Button
              v-if="cloudHref"
              as="a"
              :href="cloudHref"
              target="_blank"
              rel="noopener"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              >{{ t('workshop.workflow.tryCloud') }}</Button
            >
            <Button
              v-if="template?.downloadUrl"
              as="a"
              :href="template.downloadUrl"
              download
              variant="outline"
              class="h-auto min-h-11 max-w-full whitespace-normal"
              >{{ t('workshop.workflow.download') }}</Button
            >
          </div>

          <div
            class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
            data-testid="workflow-facts"
          >
            <section
              v-if="template?.models.length"
              :class="band"
              data-testid="workflow-runs-on"
            >
              <h3 :class="bandHeading">
                {{ t('workshop.workflow.runsOn') }}
              </h3>
              <ul class="mt-2 flex flex-col gap-1">
                <li
                  v-for="name in template.models"
                  :key="name"
                  class="flex items-center gap-2.5 py-1.5"
                >
                  <Box
                    class="size-4 shrink-0 text-primary-warm-gray"
                    aria-hidden="true"
                  />
                  <span
                    class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
                  >
                    {{ name }}
                  </span>
                </li>
              </ul>
            </section>

            <section :class="band" data-testid="workflow-details">
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
