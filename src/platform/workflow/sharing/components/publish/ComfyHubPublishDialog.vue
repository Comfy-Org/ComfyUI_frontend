<template>
  <BaseModalLayout
    :content-title="$t('comfyHubPublish.title')"
    content-padding="none"
    left-panel-width="16.5rem"
    size="md"
  >
    <template #leftPanelHeaderTitle>
      <h2 class="flex-1 text-base font-semibold select-none">
        {{ $t('comfyHubPublish.title') }}
      </h2>
    </template>

    <template #leftPanel>
      <ComfyHubPublishNav
        v-if="!needsSave"
        :current-step
        @step-click="goToStep"
      />
    </template>

    <template #header />
    <template #content>
      <div v-if="needsSave" class="flex flex-col gap-4 p-6">
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('comfyHubPublish.unsavedDescription') }}
        </p>
        <label v-if="isTemporary" class="flex flex-col gap-1">
          <span class="text-sm font-medium text-muted-foreground">
            {{ $t('shareWorkflow.workflowNameLabel') }}
          </span>
          <Input
            ref="nameInputRef"
            v-model="workflowName"
            :disabled="isSaving"
            @keydown.enter="() => handleSave()"
          />
        </label>
        <Button
          variant="primary"
          size="lg"
          :loading="isSaving"
          @click="() => handleSave()"
        >
          {{
            isSaving
              ? $t('shareWorkflow.saving')
              : $t('shareWorkflow.saveButton')
          }}
        </Button>
      </div>
      <ComfyHubPublishWizardContent
        v-else
        :current-step
        :form-data
        :is-first-step
        :is-last-step
        :is-publishing
        :on-update-form-data="updateFormData"
        :on-go-next="goNext"
        :on-go-back="goBack"
        :on-require-profile="handleRequireProfile"
        :on-gate-complete="handlePublishGateComplete"
        :on-gate-close="handlePublishGateClose"
        :on-publish="handlePublish"
      />
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import ComfyHubPublishNav from '@/platform/workflow/sharing/components/publish/ComfyHubPublishNav.vue'
import ComfyHubPublishWizardContent from '@/platform/workflow/sharing/components/publish/ComfyHubPublishWizardContent.vue'
import { useComfyHubPublishSubmission } from '@/platform/workflow/sharing/composables/useComfyHubPublishSubmission'
import {
  cachePublishPrefill,
  getCachedPrefill,
  useComfyHubPublishWizard
} from '@/platform/workflow/sharing/composables/useComfyHubPublishWizard'
import { useComfyHubProfileGate } from '@/platform/workflow/sharing/composables/useComfyHubProfileGate'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { appendJsonExt } from '@/utils/formatUtil'
import { OnCloseKey } from '@/types/widgetTypes'

const { onClose } = defineProps<{
  onClose: () => void
}>()

const { t } = useI18n()
const toast = useToast()
const { fetchProfile } = useComfyHubProfileGate()
const { submitToComfyHub } = useComfyHubPublishSubmission()
const shareService = useWorkflowShareService()
const workflowService = useWorkflowService()
const workflowStore = useWorkflowStore()
const {
  currentStep,
  formData,
  isFirstStep,
  isLastStep,
  goToStep,
  goNext,
  goBack,
  openProfileCreationStep,
  closeProfileCreationStep,
  applyPrefill
} = useComfyHubPublishWizard()
const isPublishing = ref(false)
const needsSave = ref(false)
const workflowName = ref('')
const nameInputRef = ref<InstanceType<typeof Input> | null>(null)

const isTemporary = computed(
  () => workflowStore.activeWorkflow?.isTemporary ?? false
)

function checkNeedsSave() {
  const workflow = workflowStore.activeWorkflow
  needsSave.value = !workflow || workflow.isTemporary || workflow.isModified
  if (workflow) {
    workflowName.value = workflow.filename.replace(/\.json$/i, '')
  }
}

watch(needsSave, async (needs) => {
  if (needs && isTemporary.value) {
    await nextTick()
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  }
})

function buildWorkflowPath(directory: string, filename: string): string {
  const normalizedDirectory = directory.replace(/\/+$/, '')
  const normalizedFilename = appendJsonExt(filename.replace(/\.json$/i, ''))
  return normalizedDirectory
    ? `${normalizedDirectory}/${normalizedFilename}`
    : normalizedFilename
}

const { isLoading: isSaving, execute: handleSave } = useAsyncState(
  async () => {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return

    if (workflow.isTemporary) {
      const name = workflowName.value.trim()
      if (!name) return
      const newPath = buildWorkflowPath(workflow.directory, name)
      await workflowService.renameWorkflow(workflow, newPath)
      await workflowStore.saveWorkflow(workflow)
    } else {
      await workflowService.saveWorkflow(workflow)
    }

    checkNeedsSave()
  },
  undefined,
  {
    immediate: false,
    onError: (error) => {
      console.error('Failed to save workflow:', error)
      toast.add({
        severity: 'error',
        summary: t('shareWorkflow.saveFailedTitle'),
        detail: t('shareWorkflow.saveFailedDescription')
      })
    }
  }
)

function handlePublishGateComplete() {
  closeProfileCreationStep()
  void fetchProfile({ force: true })
}

function handlePublishGateClose() {
  closeProfileCreationStep()
}

function handleRequireProfile() {
  openProfileCreationStep()
}

async function handlePublish(): Promise<void> {
  if (isPublishing.value) {
    return
  }

  isPublishing.value = true
  try {
    await submitToComfyHub(formData.value)
    const path = workflowStore.activeWorkflow?.path
    if (path) {
      cachePublishPrefill(path, formData.value)
    }
    onClose()
  } finally {
    isPublishing.value = false
  }
}

function updateFormData(patch: Partial<ComfyHubPublishFormData>) {
  formData.value = { ...formData.value, ...patch }
}

async function fetchPublishPrefill() {
  const path = workflowStore.activeWorkflow?.path
  if (!path) return

  try {
    const status = await shareService.getPublishStatus(path)
    const prefill = status.isPublished
      ? (status.prefill ?? getCachedPrefill(path))
      : getCachedPrefill(path)
    if (prefill) {
      applyPrefill(prefill)
    }
  } catch {
    const cached = getCachedPrefill(path)
    if (cached) {
      applyPrefill(cached)
    }
  }
}

onMounted(() => {
  checkNeedsSave()
  void fetchProfile()
  void fetchPublishPrefill()
})

onBeforeUnmount(() => {
  for (const image of formData.value.exampleImages) {
    if (image.file) {
      URL.revokeObjectURL(image.url)
    }
  }
})

provide(OnCloseKey, onClose)
</script>
