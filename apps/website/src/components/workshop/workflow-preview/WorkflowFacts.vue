<script setup lang="ts">
import { Cloud, Monitor } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import WorkflowCloudFacts from '@/components/workshop/workflow-preview/WorkflowCloudFacts.vue'
import WorkflowMachineFiles from '@/components/workshop/workflow-preview/WorkflowMachineFiles.vue'
import WorkflowRunsOn from '@/components/workshop/workflow-preview/WorkflowRunsOn.vue'

const { t } = translationsFor('en')
const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()

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
    (model.workflow.template?.models ?? []).map((name) => ({
      name,
      href: undefined
    }))
)
const files = computed(() => model.parts?.files ?? [])
const runsOnCloud = computed(() => model.type === 'CLOUD')

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
  <div
    class="rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-4"
    data-testid="workflow-facts"
  >
    <Tabs :default-value="runsOnCloud ? 'cloud' : 'machine'">
      <TabsList :aria-label="t('workshop.workflow.runsWhere')">
        <TabsTrigger value="cloud" data-testid="workflow-tab-cloud">
          <Cloud aria-hidden="true" />
          {{ t('workshop.workflow.onCloud') }}
        </TabsTrigger>
        <TabsTrigger value="machine" data-testid="workflow-tab-machine">
          <Monitor aria-hidden="true" />
          {{ t('workshop.workflow.onMachine') }}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="where in ['cloud', 'machine'] as const"
        :key="where"
        :value="where"
        class="flex flex-col gap-4 px-1"
      >
        <WorkflowRunsOn v-if="runsOn.length" :parts="runsOn" />
        <WorkflowCloudFacts v-if="where === 'cloud'" :runs-on-cloud :facts />
        <WorkflowMachineFiles v-else :files />
      </TabsContent>
    </Tabs>
  </div>
</template>
