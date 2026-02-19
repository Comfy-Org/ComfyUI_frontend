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
    <div v-auto-animate class="flex flex-col gap-4 p-4">
      <!-- Loading state -->
      <template v-if="dialogState === 'loading'">
        <div class="h-3 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
        <div class="h-3 w-3/5 animate-pulse rounded bg-muted-foreground/20" />
        <div class="h-10 w-full animate-pulse rounded bg-muted-foreground/20" />
      </template>

      <!-- Unsaved state -->
      <template v-if="dialogState === 'unsaved'">
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('shareWorkflow.unsavedDescription') }}
        </p>
        <label v-if="isTemporary" class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted-foreground">
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
          @click="handleSave"
        >
          {{
            isSaving
              ? $t('shareWorkflow.saving')
              : $t('shareWorkflow.saveButton')
          }}
        </Button>
      </template>

      <!-- Ready state -->
      <template v-if="dialogState === 'ready'">
        <p
          v-if="isLoadingAssets"
          class="m-0 text-xs italic text-muted-foreground"
        >
          {{ $t('shareWorkflow.checkingAssets') }}
        </p>
        <ShareAssetWarningBox
          v-else-if="requiresAcknowledgment"
          v-model:acknowledged="acknowledged"
          :assets="assetInfo.assets"
          :models="assetInfo.models"
        />
        <Button
          variant="primary"
          size="lg"
          :disabled="isPublishing || (requiresAcknowledgment && !acknowledged)"
          @click="handlePublish"
        >
          {{
            isPublishing
              ? $t('shareWorkflow.creatingLink')
              : $t('shareWorkflow.createLinkButton')
          }}
        </Button>
      </template>

      <!-- Shared state -->
      <template v-if="dialogState === 'shared' && publishResult">
        <ShareUrlCopyField :url="publishResult.shareUrl" />
        <div class="flex flex-col gap-1">
          <p
            v-if="publishResult.publishedAt"
            class="m-0 text-xs text-muted-foreground"
          >
            {{ $t('shareWorkflow.publishedOn', { date: formattedDate }) }}
          </p>
          <p class="m-0 text-xs text-muted-foreground">
            {{ $t('shareWorkflow.successDescription') }}
          </p>
        </div>
      </template>

      <!-- Stale state -->
      <template v-if="dialogState === 'stale'">
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('shareWorkflow.hasChangesDescription') }}
        </p>
        <p
          v-if="isLoadingAssets"
          class="m-0 text-xs italic text-muted-foreground"
        >
          {{ $t('shareWorkflow.checkingAssets') }}
        </p>
        <ShareAssetWarningBox
          v-else-if="requiresAcknowledgment"
          v-model:acknowledged="acknowledged"
          :assets="assetInfo.assets"
          :models="assetInfo.models"
        />
        <Button
          variant="primary"
          size="lg"
          :disabled="isPublishing || (requiresAcknowledgment && !acknowledged)"
          @click="handlePublish"
        >
          {{
            isPublishing
              ? $t('shareWorkflow.updatingLink')
              : $t('shareWorkflow.updateLinkButton')
          }}
        </Button>
      </template>
    </div>

    <!-- ComfyHub section -->
    <ComfyHubUploadSection v-if="flags.comfyHubUploadEnabled" />
  </div>
</template>

<script setup lang="ts">
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import { useAsyncState } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyHubUploadSection from '@/platform/workflow/sharing/components/ComfyHubUploadSection.vue'
import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'
import ShareUrlCopyField from '@/platform/workflow/sharing/components/ShareUrlCopyField.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import type { WorkflowPublishResult } from '@/platform/workflow/sharing/types/shareTypes'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { appendJsonExt } from '@/utils/formatUtil'

const { onClose } = defineProps<{
  onClose: () => void
}>()

const { t, locale } = useI18n()
const toast = useToast()
const { flags } = useFeatureFlags()
const shareService = useWorkflowShareService()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()

type DialogState = 'loading' | 'unsaved' | 'ready' | 'shared' | 'stale'

const dialogState = ref<DialogState>('loading')
const acknowledged = ref(false)
const workflowName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

const isTemporary = computed(
  () => workflowStore.activeWorkflow?.isTemporary ?? false
)

watch(dialogState, async (state) => {
  if (state === 'unsaved' && isTemporary.value) {
    await nextTick()
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  }
})

const {
  state: assetInfo,
  isLoading: isLoadingAssets,
  execute: reloadAssets
} = useAsyncState(
  async () => ({
    assets: shareService.getWorkflowAssets(),
    models: await shareService.getWorkflowModels()
  }),
  { assets: [], models: [] }
)

const requiresAcknowledgment = computed(
  () => assetInfo.value.assets.length > 0 || assetInfo.value.models.length > 0
)

const HEADER_TITLES: Record<DialogState, string> = {
  loading: 'shareWorkflow.loadingTitle',
  unsaved: 'shareWorkflow.unsavedTitle',
  ready: 'shareWorkflow.createLinkTitle',
  shared: 'shareWorkflow.successTitle',
  stale: 'shareWorkflow.hasChangesTitle'
}

const headerTitle = computed(() => t(HEADER_TITLES[dialogState.value]))

const formattedDate = computed(() => {
  if (!publishResult.value) return ''
  return publishResult.value.publishedAt.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

function refreshDialogState() {
  const workflow = workflowStore.activeWorkflow
  if (!workflow || workflow.isTemporary || workflow.isModified) {
    dialogState.value = 'unsaved'
    if (workflow) {
      workflowName.value = workflow.filename
    }
    return
  }

  const status = shareService.getPublishStatus(
    workflow.path,
    workflow.lastModified
  )
  if (status.isPublished && status.shareUrl && status.publishedAt) {
    publishResult.value = {
      shareUrl: status.shareUrl,
      publishedAt: status.publishedAt
    }
    dialogState.value = status.hasChangesSincePublish ? 'stale' : 'shared'
  } else {
    dialogState.value = 'ready'
  }
}

onMounted(() => {
  refreshDialogState()
})

const { isLoading: isSaving, execute: handleSave } = useAsyncState(
  async () => {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return

    if (workflow.isTemporary) {
      const name = workflowName.value.trim()
      if (!name) return
      const newPath = workflow.directory + '/' + appendJsonExt(name)
      await workflowService.renameWorkflow(workflow, newPath)
      await workflowStore.saveWorkflow(workflow)
    } else {
      await workflowService.saveWorkflow(workflow)
    }

    acknowledged.value = false
    reloadAssets()

    const status = shareService.getPublishStatus(
      workflow.path,
      workflow.lastModified
    )
    if (status.isPublished && status.shareUrl && status.publishedAt) {
      publishResult.value = {
        shareUrl: status.shareUrl,
        publishedAt: status.publishedAt
      }
      dialogState.value = 'stale'
    } else {
      dialogState.value = 'ready'
    }
  },
  undefined,
  {
    immediate: false,
    onError: (error) => {
      console.error('Failed to save workflow:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.error'),
        life: 5000
      })
    }
  }
)

const {
  state: publishResult,
  isLoading: isPublishing,
  execute: handlePublish
} = useAsyncState(
  async (): Promise<WorkflowPublishResult | null> => {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return null

    const result = await shareService.publishWorkflow(
      workflow.path,
      workflow.lastModified
    )
    dialogState.value = 'shared'
    acknowledged.value = false
    return result
  },
  null,
  {
    immediate: false,
    onError: (error) => {
      console.error('Failed to publish workflow:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: error instanceof Error ? error.message : t('g.error'),
        life: 5000
      })
    }
  }
)
</script>
