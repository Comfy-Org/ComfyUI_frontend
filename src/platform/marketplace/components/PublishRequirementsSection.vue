<template>
  <div class="rounded-lg border border-border-default p-4 flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium">
        {{ t('templateWorkflows.publish.requirements') }}
      </span>
      <div class="flex items-center gap-2">
        <span v-if="detectionResult" class="text-xs italic text-muted">
          {{ detectionResult }}
        </span>
        <Button variant="secondary" size="sm" @click="autoDetectRequirements">
          {{ t('templateWorkflows.publish.vramDetect') }}
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.customNodes') }}
      </label>
      <TagAutocompleteInput
        :model-value="wizardData.customNodes ?? []"
        :suggest="suggestCustomNodes"
        :placeholder="t('templateWorkflows.publish.customNodesPlaceholder')"
        @update:model-value="(value) => (wizardData.customNodes = value)"
      />
      <span class="text-xs text-muted">
        {{ t('templateWorkflows.publish.customNodesHint') }}
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.requiredModels') }}
      </label>
      <TagAutocompleteInput
        :model-value="modelDisplayStrings"
        :placeholder="t('templateWorkflows.publish.requiredModelsPlaceholder')"
        @update:model-value="onModelsChanged"
      />
      <span class="text-xs text-muted">
        {{ t('templateWorkflows.publish.requiredModelsHint') }}
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.vramEstimate') }}
        ({{ t('templateWorkflows.publish.vramEstimateUnit') }})
      </label>
      <InputText
        :model-value="vramDisplay"
        :placeholder="t('templateWorkflows.publish.vramEstimatePlaceholder')"
        class="w-full"
        @update:model-value="onVramInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import InputText from 'primevue/inputtext'

import Button from '@/components/ui/button/Button.vue'
import { app } from '@/scripts/app'
import { detectCustomNodeTypes } from '@/services/workflowCustomNodeDetectionService'
import { detectModels } from '@/services/workflowModelDetectionService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { extractVramSnapshot } from '@/utils/vramUtil'

import TagAutocompleteInput from './TagAutocompleteInput.vue'
import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'

const { t } = useI18n()
const { wizardData } = usePublishTemplateWizard()
const nodeDefStore = useNodeDefStore()
const modelToNodeStore = useModelToNodeStore()
const systemStatsStore = useSystemStatsStore()

const detectionResult = ref<string>()

function detectCustomNodes() {
  wizardData.value.customNodes = detectCustomNodeTypes(
    app.rootGraph,
    nodeDefStore.nodeDefsByName
  )
}

function detectRequiredModels() {
  wizardData.value.requiredModels = detectModels(
    app.rootGraph,
    modelToNodeStore.modelToNodeMap
  ).map(({ name, category }) => ({ name, category }))
}

const modelDisplayStrings = computed(
  () =>
    wizardData.value.requiredModels?.map(
      (model) => `${model.category}/${model.name}`
    ) ?? []
)

function onModelsChanged(strings: string[]) {
  wizardData.value.requiredModels = strings.map(parseModelString)
}

function parseModelString(input: string) {
  const slashIndex = input.indexOf('/')
  if (slashIndex > 0) {
    return {
      category: input.slice(0, slashIndex),
      name: input.slice(slashIndex + 1)
    }
  }
  return { category: 'other', name: input }
}

const BYTES_PER_GB = 1024 ** 3

const vramDisplay = computed(() => {
  const estimate = wizardData.value.vramEstimate
  return estimate != null ? String(Math.round(estimate / BYTES_PER_GB)) : ''
})

function onVramInput(value: string | undefined) {
  if (!value) {
    wizardData.value.vramEstimate = undefined
    return
  }
  const parsed = parseFloat(value)
  wizardData.value.vramEstimate =
    !isNaN(parsed) && parsed > 0 ? Math.round(parsed * BYTES_PER_GB) : undefined
}

function detectVram() {
  const stats = systemStatsStore.systemStats
  if (!stats) return

  const { torchVramTotal, torchVramFree } = extractVramSnapshot(stats)
  const used = torchVramTotal - torchVramFree
  if (used > 0) {
    wizardData.value.vramEstimate = used
  }
}

function autoDetectRequirements() {
  detectCustomNodes()
  detectRequiredModels()
  detectVram()

  const customNodeCount = wizardData.value.customNodes?.length ?? 0
  const modelCount = wizardData.value.requiredModels?.length ?? 0
  const vram = vramDisplay.value
    ? `${Number(vramDisplay.value).toLocaleString()} GB`
    : '0 GB'

  detectionResult.value =
    customNodeCount || modelCount || vram !== '0 GB'
      ? t('templateWorkflows.publish.detected', {
          customNodes: customNodeCount.toLocaleString(),
          models: modelCount.toLocaleString(),
          vram
        })
      : t('templateWorkflows.publish.detectedNone')

  setTimeout(() => {
    detectionResult.value = undefined
  }, 4000)
}

async function suggestCustomNodes(query: string): Promise<{ tags: string[] }> {
  const allNames = Object.values(nodeDefStore.nodeDefsByName)
    .filter((def) => !def.isCoreNode)
    .map((def) => def.name)
  const unique = [...new Set(allNames)]

  if (!query) return { tags: unique.slice(0, 20) }

  const lower = query.toLowerCase()
  return {
    tags: unique.filter((name) => name.toLowerCase().includes(lower))
  }
}

defineExpose({ autoDetectRequirements })
</script>
