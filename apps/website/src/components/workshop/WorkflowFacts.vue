<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import WorkflowModelLinks from './WorkflowModelLinks.vue'
import WorkflowAuthor from './WorkflowAuthor.vue'
const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()
const t = computed(
  () => translationsFor(model.catalogDetails?.locale ?? 'en').t
)
const models = computed(() =>
  model.catalogDetails
    ? model.catalogDetails.models.filter((item) => item.name.trim())
    : (model.workflow.template?.models ?? []).map((name) => ({
        uid: name,
        name,
        href: undefined
      }))
)
const OUTPUT_LABEL: Record<string, TranslationKey> = {
  image: 'workshop.task.image',
  video: 'workshop.task.video',
  audio: 'workshop.task.audio'
}

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
  if (model.catalogDetails) return catalogFacts(model.catalogDetails)
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

function catalogFacts(
  details: NonNullable<WorkflowWorkshopModelDetail['catalogDetails']>
) {
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
</script>
<template>
  <div
    v-if="facts.length || models.length"
    class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    data-testid="workflow-facts"
  >
    <WorkflowModelLinks
      :models="models"
      :locale="model.catalogDetails?.locale ?? 'en'"
    />

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
          <dd class="min-w-0 truncate text-primary-comfy-canvas tabular-nums">
            <WorkflowAuthor
              v-if="fact.label === 'workshop.workflow.factAuthor'"
              :name="fact.value"
              :avatar="model.catalogDetails?.authorAvatarURL"
            />
            <template v-else>{{ fact.value }}</template>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
