<template>
  <div
    class="flex w-full max-w-[480px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-medium text-base-foreground">
        {{ headerTitle }}
      </h2>
      <button
        class="cursor-pointer rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-foreground"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-4 p-4">
      <!-- Unsaved state -->
      <template v-if="dialogState === 'unsaved'">
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('shareWorkflow.unsavedDescription') }}
        </p>
        <Button variant="primary" size="lg" @click="handleSave">
          {{ $t('shareWorkflow.saveButton') }}
        </Button>
      </template>

      <!-- Unpublished state -->
      <template v-if="dialogState === 'unpublished'">
        <ShareAssetWarningBox
          v-if="requiresAcknowledgment"
          v-model:acknowledged="acknowledged"
          :assets
          :models
        />
        <Button
          variant="primary"
          size="lg"
          :disabled="requiresAcknowledgment && !acknowledged"
          :loading="isPublishing"
          @click="handlePublish"
        >
          {{
            isPublishing
              ? $t('shareWorkflow.publishing')
              : $t('shareWorkflow.publishButton')
          }}
        </Button>
      </template>

      <!-- Just published state -->
      <template v-if="dialogState === 'justPublished' && shareUrl">
        <ShareUrlCopyField :url="shareUrl" />
        <p class="m-0 text-xs text-muted-foreground">
          <span v-if="publishedAt">
            {{ $t('shareWorkflow.publishedOn', { date: formattedDate }) }}
          </span>
          <br />
          {{ $t('shareWorkflow.successDescription') }}
        </p>
      </template>

      <!-- Has changes state -->
      <template v-if="dialogState === 'hasChanges' && shareUrl">
        <ShareUrlCopyField :url="shareUrl" />
        <p class="m-0 text-xs text-muted-foreground">
          <span v-if="publishedAt">
            {{ $t('shareWorkflow.publishedOn', { date: formattedDate }) }}
          </span>
          <br />
          {{ $t('shareWorkflow.hasChangesDescription') }}
        </p>
        <ShareAssetWarningBox
          v-if="requiresAcknowledgment"
          v-model:acknowledged="acknowledged"
          :assets
          :models
        />
        <Button
          variant="primary"
          size="lg"
          :disabled="requiresAcknowledgment && !acknowledged"
          :loading="isPublishing"
          @click="handlePublish"
        >
          {{
            isPublishing
              ? $t('shareWorkflow.republishing')
              : $t('shareWorkflow.republishButton')
          }}
        </Button>
      </template>
    </div>

    <!-- ComfyHub section -->
    <ComfyHubUploadSection />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyHubUploadSection from '@/platform/workflow/sharing/components/ComfyHubUploadSection.vue'
import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'
import ShareUrlCopyField from '@/platform/workflow/sharing/components/ShareUrlCopyField.vue'
import Button from '@/components/ui/button/Button.vue'
import type {
  WorkflowAsset,
  WorkflowModel
} from '@/platform/workflow/sharing/types/shareTypes'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'

const { onClose } = defineProps<{
  onClose: () => void
}>()

const { t, locale } = useI18n()
const shareService = useWorkflowShareService()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()

type DialogState = 'unsaved' | 'unpublished' | 'justPublished' | 'hasChanges'

const dialogState = ref<DialogState>('unsaved')
const shareUrl = ref<string | null>(null)
const publishedAt = ref<Date | null>(null)
const isPublishing = ref(false)
const acknowledged = ref(false)
const assets = ref<WorkflowAsset[]>([])
const models = ref<WorkflowModel[]>([])

const requiresAcknowledgment = computed(
  () => assets.value.length > 0 || models.value.length > 0
)

const HEADER_TITLES: Record<DialogState, string> = {
  unsaved: 'shareWorkflow.unsavedTitle',
  unpublished: 'shareWorkflow.publishTitle',
  justPublished: 'shareWorkflow.successTitle',
  hasChanges: 'shareWorkflow.hasChangesTitle'
}

const headerTitle = computed(() => t(HEADER_TITLES[dialogState.value]))

const formattedDate = computed(() => {
  if (!publishedAt.value) return ''
  return publishedAt.value.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

function refreshDialogState() {
  const workflow = workflowStore.activeWorkflow
  if (!workflow || workflow.isTemporary || workflow.isModified) {
    dialogState.value = 'unsaved'
    return
  }

  const status = shareService.getPublishStatus(
    workflow.path,
    workflow.lastModified
  )
  if (status.isPublished) {
    shareUrl.value = status.shareUrl
    publishedAt.value = status.publishedAt
    dialogState.value = status.hasChangesSincePublish
      ? 'hasChanges'
      : 'justPublished'
  } else {
    dialogState.value = 'unpublished'
  }
}

onMounted(async () => {
  assets.value = shareService.getWorkflowAssets()
  models.value = await shareService.getWorkflowModels()
  refreshDialogState()
})

async function handleSave() {
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return

  if (workflow.isTemporary) {
    await workflowService.saveWorkflowAs(workflow)
  } else {
    await workflowService.saveWorkflow(workflow)
  }

  refreshDialogState()
}

async function handlePublish() {
  const workflow = workflowStore.activeWorkflow
  if (!workflow) return

  isPublishing.value = true
  try {
    const result = await shareService.publishWorkflow(
      workflow.path,
      workflow.lastModified
    )
    shareUrl.value = result.shareUrl
    publishedAt.value = result.publishedAt
    dialogState.value = 'justPublished'
    acknowledged.value = false
  } finally {
    isPublishing.value = false
  }
}
</script>
