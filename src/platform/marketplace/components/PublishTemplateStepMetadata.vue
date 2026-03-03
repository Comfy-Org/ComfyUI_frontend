<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.selectWorkflow') }}
      </label>
      <SingleSelect
        :model-value="selectedWorkflowPath"
        :label="t('templateWorkflows.publish.selectWorkflowPlaceholder')"
        :options="workflowOptions"
        @update:model-value="onWorkflowSelected"
      />
      <span v-if="errors.template" class="text-xs text-destructive-background">
        {{ errors.template }}
      </span>
    </div>

    <div
      class="rounded-lg border border-border-default p-4 flex flex-col gap-4"
    >
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
          :placeholder="
            t('templateWorkflows.publish.requiredModelsPlaceholder')
          "
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

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.shortDescription') }}
      </label>
      <MarkdownInput
        v-model="wizardData.shortDescription"
        :has-error="!!errors.shortDescription"
        :placeholder="
          t('templateWorkflows.publish.shortDescriptionPlaceholder')
        "
        :maxlength="200"
      />
      <span
        v-if="errors.shortDescription"
        class="text-xs text-destructive-background"
      >
        {{ errors.shortDescription }}
      </span>
      <span v-else class="text-xs text-muted">
        {{ (wizardData.shortDescription ?? '').length }}/200 ·
        {{ t('templateWorkflows.publish.markdownSupported') }}
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.tutorialUrl') }}
      </label>
      <InputText
        v-model="wizardData.tutorialUrl"
        :placeholder="t('templateWorkflows.publish.tutorialUrlPlaceholder')"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.difficulty') }}
      </label>
      <RadioGroupRoot
        :model-value="wizardData.difficulty ?? undefined"
        class="flex flex-wrap gap-2"
        @update:model-value="
          (value: string) =>
            (wizardData.difficulty = value as Difficulty | undefined)
        "
      >
        <label
          v-for="option in difficultyOptions"
          :key="option.value"
          :class="
            cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm transition-colors',
              wizardData.difficulty === option.value &&
                'border-primary-background bg-primary-background/10'
            )
          "
        >
          <RadioGroupItem :value="option.value" class="sr-only" />
          <img
            :src="DIFFICULTY_SPRITES[option.value]"
            :alt="option.name"
            class="size-5 rounded-sm object-cover"
          />
          {{ option.name }}
        </label>
      </RadioGroupRoot>
      <span
        v-if="errors.difficulty"
        class="text-xs text-destructive-background"
      >
        {{ errors.difficulty }}
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.categories') }}
      </label>
      <MultiSelectInput
        :model-value="
          wizardData.categories?.map((category) => ({
            name: category,
            value: category
          })) ?? []
        "
        :label="t('templateWorkflows.publish.categoriesPlaceholder')"
        :options="
          categoryOptions?.map((category) => ({
            name: category,
            value: category
          })) ?? []
        "
        show-search-box
        @update:model-value="
          (value) => (wizardData.categories = value.map(({ value }) => value))
        "
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.tags') }}
      </label>
      <TagAutocompleteInput
        :model-value="wizardData.tags ?? []"
        :placeholder="t('templateWorkflows.publish.tagsPlaceholder')"
        @update:model-value="(value) => (wizardData.tags = value)"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.license') }}
      </label>
      <SingleSelect
        :model-value="wizardData.license ?? undefined"
        :label="t('templateWorkflows.publish.licensePlaceholder')"
        :options="licenseOptions"
        @update:model-value="(value) => (wizardData.license = value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

import MultiSelectInput from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import Button from '@/components/ui/button/Button.vue'
import type { SelectOption } from '@/components/input/types'
import InputText from 'primevue/inputtext'
import MarkdownInput from '@/components/input/MarkdownInput.vue'
import { cn } from '@/utils/tailwindUtil'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { detectCustomNodeTypes } from '@/services/workflowCustomNodeDetectionService'
import { detectModels } from '@/services/workflowModelDetectionService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { extractVramSnapshot } from '@/utils/vramUtil'

import TagAutocompleteInput from './TagAutocompleteInput.vue'
import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'
import { licenseTypeSchema, metadataSchema } from '../schemas/templateSchema'
import { useCategories } from '../composables/useCategories'
import type { Difficulty } from '../types/marketplace'
import { DIFFICULTY_SPRITES } from '../types/marketplace'

const { t } = useI18n()
const { wizardData } = usePublishTemplateWizard()
const workflowStore = useWorkflowStore()
const nodeDefStore = useNodeDefStore()
const modelToNodeStore = useModelToNodeStore()
const systemStatsStore = useSystemStatsStore()

const errors = ref<Record<string, string>>({})

const selectedWorkflowPath = ref<string | undefined>(
  workflowStore.persistedWorkflows.find(
    (wf) => wf.filename === wizardData.value.name
  )?.path
)

watch(
  () => wizardData.value.name,
  (name) => {
    if (!name) {
      resetForm()
    }
  }
)

const workflowOptions = computed(() =>
  workflowStore.persistedWorkflows.map(({ filename, path }) => ({
    name: filename,
    value: path
  }))
)

function resetForm() {
  wizardData.value.name = undefined
  wizardData.value.title = undefined
  wizardData.value.description = undefined
  wizardData.value.mediaType = undefined
  wizardData.value.mediaSubtype = undefined
  selectedWorkflowPath.value = undefined
}

function onWorkflowSelected(path: string | undefined) {
  if (!path) {
    resetForm()
    return
  }
  const wf = workflowStore.getWorkflowByPath(path)
  if (!wf) return

  selectedWorkflowPath.value = path
  wizardData.value.name = wf.filename
  wizardData.value.title = wf.filename.replace(/\.json$/, '')
  wizardData.value.description = ''
  wizardData.value.mediaType = 'image'
  wizardData.value.mediaSubtype = 'photo'

  autoDetectRequirements()
}

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
    wizardData.value.requiredModels?.map((m) => `${m.category}/${m.name}`) ?? []
)

function onModelsChanged(strings: string[]) {
  wizardData.value.requiredModels = strings.map(parseModelString)
}

function parseModelString(s: string) {
  const slashIndex = s.indexOf('/')
  if (slashIndex > 0) {
    return { category: s.slice(0, slashIndex), name: s.slice(slashIndex + 1) }
  }
  return { category: 'other', name: s }
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

const detectionResult = ref<string>()

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

const difficultyOptions = [
  { name: t('templateWorkflows.publish.beginner'), value: 'beginner' },
  { name: t('templateWorkflows.publish.intermediate'), value: 'intermediate' },
  { name: t('templateWorkflows.publish.advanced'), value: 'advanced' }
] satisfies SelectOption[]

const licenseOptions = licenseTypeSchema.options.map((value) => ({
  name: t(`templateWorkflows.publish.licenses.${value}`),
  value
})) satisfies SelectOption[]

const { categories: categoryOptions } = useCategories()

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

function validate(): boolean {
  const map: Record<string, string> = {}

  if (!wizardData.value.name) {
    map.template = 'Select a workflow to submit'
  }

  const result = metadataSchema.safeParse(wizardData.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.')
      if (!map[key]) map[key] = issue.message
    }
  }

  errors.value = map
  return Object.keys(map).length === 0
}

defineExpose({ validate })
</script>
