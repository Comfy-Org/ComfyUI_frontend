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

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.shortDescription') }}
      </label>
      <Textarea
        v-model="wizardData.shortDescription"
        :class="errors.shortDescription && 'border-destructive-background'"
        :placeholder="
          t('templateWorkflows.publish.shortDescriptionPlaceholder')
        "
        :maxlength="200"
        rows="3"
      />
      <span
        v-if="errors.shortDescription"
        class="text-xs text-destructive-background"
      >
        {{ errors.shortDescription }}
      </span>
      <span v-else class="text-xs text-muted">
        {{ (wizardData.shortDescription ?? '').length }}/200
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.difficulty') }}
      </label>
      <SingleSelect
        :model-value="wizardData.difficulty ?? undefined"
        :label="t('templateWorkflows.publish.difficulty')"
        :options="difficultyOptions"
        @update:model-value="
          (value: string | undefined) =>
            (wizardData.difficulty = value as Difficulty | undefined)
        "
      />
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
        {{ t('templateWorkflows.publish.version') }}
      </label>
      <InputText v-model="wizardData.version" placeholder="1.0.0" />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.changelog') }}
      </label>
      <Textarea
        v-model="wizardData.changelog"
        :placeholder="t('templateWorkflows.publish.changelogPlaceholder')"
        rows="2"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MultiSelectInput from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import type { SelectOption } from '@/components/input/types'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import InputText from 'primevue/inputtext'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import TagAutocompleteInput from './TagAutocompleteInput.vue'
import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'
import { licenseTypeSchema, metadataSchema } from '../schemas/templateSchema'
import { useCategories } from '../composables/useCategories'
import type { Difficulty } from '../types/marketplace'

const { t } = useI18n()
const { wizardData } = usePublishTemplateWizard()
const workflowStore = useWorkflowStore()

const errors = ref<Record<string, string>>({})

const selectedWorkflowPath = ref<string | undefined>(wizardData.value.name)

const workflowOptions = computed(() =>
  workflowStore.persistedWorkflows.map(({ filename, path }) => ({
    name: filename,
    value: path
  }))
)

function onWorkflowSelected(path: string | undefined) {
  selectedWorkflowPath.value = path
  if (!path) {
    wizardData.value.name = undefined
    wizardData.value.title = undefined
    wizardData.value.description = undefined
    wizardData.value.mediaType = undefined
    wizardData.value.mediaSubtype = undefined
    return
  }
  const wf = workflowStore.getWorkflowByPath(path)
  if (!wf) return

  wizardData.value.name = wf.filename
  wizardData.value.title = wf.filename.replace(/\.json$/, '')
  wizardData.value.description = ''
  wizardData.value.mediaType = 'image'
  wizardData.value.mediaSubtype = 'photo'
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
