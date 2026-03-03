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
        v-model="wizardData.difficulty"
        :label="t('templateWorkflows.publish.difficulty')"
        :options="difficultyOptions"
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
        {{ t('templateWorkflows.publish.version') }}
      </label>
      <InputText v-model="wizardData.version" placeholder="1.0.0" />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium">
        {{ t('templateWorkflows.publish.changelog') }}
      </label>
      <Textarea
        :model-value="wizardData.changelog ?? ''"
        :placeholder="t('templateWorkflows.publish.changelogPlaceholder')"
        rows="2"
        @update:model-value="(value) => (wizardData.changelog = String(value))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SingleSelect from '@/components/input/SingleSelect.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import InputText from 'primevue/inputtext'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { usePublishTemplateWizard } from '../composables/usePublishTemplateWizard'
import { metadataSchema } from '../schemas/templateSchema'

const { t } = useI18n()
const { wizardData } = usePublishTemplateWizard()
const workflowStore = useWorkflowStore()

const errors = ref<Record<string, string>>({})

const selectedWorkflowPath = ref<string | undefined>(
  wizardData.value.template?.name
)

const workflowOptions = computed(() =>
  workflowStore.persistedWorkflows.map((wf) => ({
    name: wf.filename,
    value: wf.path
  }))
)

function onWorkflowSelected(path: string | undefined) {
  selectedWorkflowPath.value = path
  if (!path) {
    wizardData.value.template = undefined
    return
  }
  const wf = workflowStore.getWorkflowByPath(path)
  if (!wf) return

  wizardData.value.template = {
    name: wf.filename,
    title: wf.filename.replace(/\.json$/, ''),
    description: '',
    mediaType: 'image',
    mediaSubtype: 'photo'
  }
}

const difficultyOptions = [
  { name: t('templateWorkflows.publish.beginner'), value: 'beginner' },
  { name: t('templateWorkflows.publish.intermediate'), value: 'intermediate' },
  { name: t('templateWorkflows.publish.advanced'), value: 'advanced' }
]

function validate(): boolean {
  const map: Record<string, string> = {}

  if (!wizardData.value.template) {
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
