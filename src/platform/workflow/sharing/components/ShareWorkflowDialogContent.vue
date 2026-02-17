<template>
  <div
    class="flex w-full max-w-[480px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-6"
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
    <div class="flex flex-col gap-4 px-6 py-4">
      <!-- Unpublished state -->
      <template v-if="dialogState === 'unpublished'">
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('shareWorkflow.publishDescription') }}
        </p>
        <ShareAssetWarningBox
          v-model:acknowledged="acknowledged"
          :assets="assets"
          :models="models"
        />
        <Button
          variant="primary"
          size="lg"
          :disabled="!acknowledged"
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
          v-model:acknowledged="acknowledged"
          :assets="assets"
          :models="models"
        />
        <Button
          variant="primary"
          size="lg"
          :disabled="!acknowledged"
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

const { onClose, workflowId = 'current-workflow' } = defineProps<{
  onClose: () => void
  workflowId?: string
}>()

const { t, locale } = useI18n()
const shareService = useWorkflowShareService()

type DialogState = 'unpublished' | 'justPublished' | 'hasChanges'

const dialogState = ref<DialogState>('unpublished')
const shareUrl = ref<string | null>(null)
const publishedAt = ref<Date | null>(null)
const isPublishing = ref(false)
const acknowledged = ref(false)
const assets = ref<WorkflowAsset[]>([])
const models = ref<WorkflowModel[]>([])

const HEADER_TITLES: Record<DialogState, string> = {
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

onMounted(() => {
  assets.value = shareService.getWorkflowAssets()
  models.value = shareService.getWorkflowModels()

  const status = shareService.getPublishStatus(workflowId)
  if (status.isPublished) {
    shareUrl.value = status.shareUrl
    publishedAt.value = status.publishedAt
    dialogState.value = status.hasChangesSincePublish
      ? 'hasChanges'
      : 'justPublished'
  }
})

async function handlePublish() {
  isPublishing.value = true
  try {
    const result = await shareService.publishWorkflow(workflowId)
    shareUrl.value = result.shareUrl
    publishedAt.value = result.publishedAt
    dialogState.value = 'justPublished'
    acknowledged.value = false
  } finally {
    isPublishing.value = false
  }
}
</script>
