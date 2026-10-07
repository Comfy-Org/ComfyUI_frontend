<script setup lang="ts">
import { Box, Cloud, Monitor } from '@lucide/vue'
import { computed } from 'vue'

import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import WorkflowFileRow from '@/components/workshop/workflow-preview/WorkflowFileRow.vue'
import WorkflowPartRow from '@/components/workshop/workflow-preview/WorkflowPartRow.vue'

const { t } = translationsFor('en')
const { model } = defineProps<{ model: WorkflowWorkshopModelDetail }>()

const GROUP_HEADING =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'

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
        <section v-if="runsOn.length" data-testid="workflow-runs-on">
          <h3 :class="GROUP_HEADING">
            {{ t('workshop.workflow.runsOn') }}
          </h3>
          <ul class="mt-2 flex flex-col gap-1">
            <li v-for="part in runsOn" :key="part.name">
              <WorkflowPartRow
                :icon="Box"
                :name="part.name"
                :href="part.href"
                text-class="text-base"
              />
            </li>
          </ul>
        </section>

        <template v-if="where === 'cloud'">
          <p class="text-sm text-primary-warm-white">
            {{
              t(
                runsOnCloud
                  ? 'workshop.workflow.cloudReady'
                  : 'workshop.workflow.runsOwn'
              )
            }}
          </p>
          <dl
            class="flex flex-col gap-1 text-sm"
            data-testid="workflow-details"
          >
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
        </template>

        <section v-else-if="files.length" data-testid="workflow-files">
          <h3 :class="GROUP_HEADING">
            {{ t('workshop.workflow.filesNeeded') }} · {{ files.length }}
          </h3>
          <p class="mt-1 mb-2 text-xs text-primary-warm-gray">
            {{ t('workshop.workflow.filesNote') }}
          </p>
          <ul class="flex flex-col">
            <li v-for="file in files" :key="file.name">
              <WorkflowFileRow
                :name="file.name"
                :href="file.href"
                :type="fileType(file.directory)"
                :folder="file.folder"
                :download-url="file.downloadUrl"
              />
            </li>
          </ul>
        </section>
        <p
          v-else
          class="text-sm text-primary-warm-gray"
          data-testid="workflow-no-files"
        >
          {{ t('workshop.workflow.noFiles') }}
        </p>
      </TabsContent>
    </Tabs>
  </div>
</template>
