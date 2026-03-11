<template>
  <div class="flex w-full flex-col">
    <header
      class="flex h-12 items-center justify-between gap-2 border-b border-border-default px-4"
    >
      <div
        v-if="showPublishToHubTab"
        role="tablist"
        class="flex flex-1 items-center gap-2"
      >
        <Button
          id="tab-share-link"
          role="tab"
          :aria-selected="dialogMode === 'shareLink'"
          :class="tabButtonClass('shareLink')"
          @click="handleDialogModeChange('shareLink')"
        >
          {{ $t('shareWorkflow.shareLinkTab') }}
        </Button>
        <Button
          id="tab-publish"
          role="tab"
          :aria-selected="dialogMode === 'publishToHub'"
          :class="tabButtonClass('publishToHub')"
          @click="handleDialogModeChange('publishToHub')"
        >
          <i class="icon-[lucide--globe] size-4" aria-hidden="true" />
          {{ $t('shareWorkflow.publishToHubTab') }}
        </Button>
      </div>
      <div v-else class="select-none">
        {{ $t('shareWorkflow.shareLinkTab') }}
      </div>
      <Button size="icon" :aria-label="$t('g.close')" @click="onClose">
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </header>

    <main v-auto-animate class="flex flex-col gap-4 p-4">
      <div
        v-show="dialogMode === 'shareLink'"
        v-auto-animate
        :role="showPublishToHubTab ? 'tabpanel' : undefined"
        :aria-labelledby="showPublishToHubTab ? 'tab-share-link' : undefined"
        class="flex flex-col gap-4"
      >
        <template v-if="dialogState === 'loading'">
          <Skeleton class="h-3 w-4/5" />
          <Skeleton class="h-3 w-3/5" />
          <Skeleton class="h-10 w-full" />
        </template>

        <template v-if="dialogState === 'unsaved'">
          <p class="m-0 text-sm text-muted-foreground">
            {{ $t('shareWorkflow.unsavedDescription') }}
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
        </template>

        <template v-if="dialogState === 'ready' || dialogState === 'stale'">
          <p
            v-if="dialogState === 'stale'"
            class="m-0 text-xs text-muted-foreground"
          >
            {{ $t('shareWorkflow.hasChangesDescription') }}
          </p>
          <p
            v-if="isLoadingAssets"
            class="m-0 text-sm text-muted-foreground italic"
          >
            {{ $t('shareWorkflow.checkingAssets') }}
          </p>
          <ShareAssetWarningBox
            v-else-if="requiresAcknowledgment"
            v-model:acknowledged="acknowledged"
            :items="assetInfo"
          />
          <Button
            variant="primary"
            size="lg"
            :disabled="
              isPublishing ||
              isLoadingAssets ||
              (requiresAcknowledgment && !acknowledged)
            "
            @click="() => handlePublish()"
          >
            {{ publishButtonLabel }}
          </Button>
        </template>

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
      </div>
      <div
        v-if="showPublishToHubTab"
        v-show="dialogMode === 'publishToHub'"
        v-auto-animate
        role="tabpanel"
        aria-labelledby="tab-publish"
        data-testid="publish-tab-panel"
        class="min-h-0"
      >
        <ComfyHubPublishIntroPanel
          data-testid="publish-intro"
          :on-create-profile="handleOpenPublishDialog"
          :on-close="onClose"
          :show-close-button="false"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import { useAsyncState } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyHubPublishIntroPanel from '@/platform/workflow/sharing/components/profile/ComfyHubPublishIntroPanel.vue'
import ShareAssetWarningBox from '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue'
import ShareUrlCopyField from '@/platform/workflow/sharing/components/ShareUrlCopyField.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useComfyHubPublishDialog } from '@/platform/workflow/sharing/composables/useComfyHubPublishDialog'
import type {
  WorkflowPublishResult,
  WorkflowPublishStatus
} from '@/platform/workflow/sharing/types/shareTypes'
import { useWorkflowShareService } from '@/platform/workflow/sharing/services/workflowShareService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useAppMode } from '@/composables/useAppMode'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTelemetry } from '@/platform/telemetry'
import { appendJsonExt } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const { onClose } = defineProps<{
  onClose: () => void
}>()

const { t, locale } = useI18n()
const toast = useToast()
const { flags } = useFeatureFlags()
const publishDialog = useComfyHubPublishDialog()
const shareService = useWorkflowShareService()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const { isAppMode } = useAppMode()

function getShareSource() {
  return isAppMode.value ? 'app_mode' : ('graph_mode' as const)
}

type DialogState = 'loading' | 'unsaved' | 'ready' | 'shared' | 'stale'
type DialogMode = 'shareLink' | 'publishToHub'

function resolveDialogStateFromStatus(
  status: WorkflowPublishStatus,
  workflow: { lastModified: number }
): { publishResult: WorkflowPublishResult | null; dialogState: DialogState } {
  if (!status.isPublished) return { publishResult: null, dialogState: 'ready' }
  const publishedAtMs = status.publishedAt.getTime()
  const lastModifiedMs = workflow.lastModified
  return {
    publishResult: {
      shareId: status.shareId,
      shareUrl: status.shareUrl,
      publishedAt: status.publishedAt
    },
    dialogState: lastModifiedMs > publishedAtMs ? 'stale' : 'shared'
  }
}

const dialogState = ref<DialogState>('loading')
const dialogMode = ref<DialogMode>('shareLink')
const acknowledged = ref(false)
const workflowName = ref('')
const nameInputRef = ref<InstanceType<typeof Input> | null>(null)

function focusNameInput() {
  nameInputRef.value?.focus()
  nameInputRef.value?.select()
}

const isTemporary = computed(
  () => workflowStore.activeWorkflow?.isTemporary ?? false
)

watch(dialogState, async (state) => {
  if (state === 'unsaved' && isTemporary.value) {
    await nextTick()
    focusNameInput()
  }
})

const {
  state: assetInfo,
  isLoading: isLoadingAssets,
  execute: reloadAssets
} = useAsyncState(() => shareService.getShareableAssets(), [])

const requiresAcknowledgment = computed(() => assetInfo.value.length > 0)
const showPublishToHubTab = computed(() => flags.comfyHubUploadEnabled)

function handleOpenPublishDialog() {
  onClose()
  publishDialog.show()
}

function tabButtonClass(mode: DialogMode) {
  return cn(
    'cursor-pointer border-none transition-colors',
    dialogMode.value === mode
      ? 'bg-secondary-background text-base-foreground'
      : 'bg-transparent text-muted-foreground hover:bg-secondary-background-hover'
  )
}

function handleDialogModeChange(nextMode: DialogMode) {
  if (nextMode === dialogMode.value) return
  if (nextMode === 'publishToHub' && !showPublishToHubTab.value) return
  dialogMode.value = nextMode
}

watch(showPublishToHubTab, (isVisible) => {
  if (!isVisible && dialogMode.value === 'publishToHub') {
    dialogMode.value = 'shareLink'
  }
})

const formattedDate = computed(() => {
  if (!publishResult.value) return ''
  return publishResult.value.publishedAt.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const publishButtonLabel = computed(() => {
  if (dialogState.value === 'stale') {
    return isPublishing.value
      ? t('shareWorkflow.updatingLink')
      : t('shareWorkflow.updateLinkButton')
  }
  return isPublishing.value
    ? t('shareWorkflow.creatingLink')
    : t('shareWorkflow.createLinkButton')
})

function stripJsonExtension(filename: string): string {
  return filename.replace(/\.json$/i, '')
}

function buildWorkflowPath(directory: string, filename: string): string {
  const normalizedDirectory = directory.replace(/\/+$/, '')
  const normalizedFilename = appendJsonExt(stripJsonExtension(filename))

  return normalizedDirectory
    ? `${normalizedDirectory}/${normalizedFilename}`
    : normalizedFilename
}

async function refreshDialogState() {
  const workflow = workflowStore.activeWorkflow

  if (!workflow || workflow.isTemporary || workflow.isModified) {
    dialogState.value = 'unsaved'
    useTelemetry()?.trackShareFlow({
      step: 'save_prompted',
      source: getShareSource()
    })
    if (workflow) {
      workflowName.value = stripJsonExtension(workflow.filename)
    }
    return
  }

  try {
    const status = await shareService.getPublishStatus(workflow.path)
    const resolved = resolveDialogStateFromStatus(status, workflow)
    publishResult.value = resolved.publishResult
    dialogState.value = resolved.dialogState
  } catch (error) {
    console.error('Failed to load publish status:', error)
    publishResult.value = null
    dialogState.value = 'ready'
    toast.add({
      severity: 'error',
      summary: t('shareWorkflow.loadFailed')
    })
  }
}

onMounted(() => {
  void refreshDialogState()
})

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

    acknowledged.value = false
    await reloadAssets()

    await refreshDialogState()
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

const {
  state: publishResult,
  isLoading: isPublishing,
  execute: handlePublish
} = useAsyncState(
  async (): Promise<WorkflowPublishResult | null> => {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return null

    const publishableAssets = assetInfo.value

    if (publishableAssets.length > 0 && !acknowledged.value) {
      return null
    }

    const result = await shareService.publishWorkflow(
      workflow.path,
      publishableAssets
    )
    dialogState.value = 'shared'
    acknowledged.value = false
    useTelemetry()?.trackShareFlow({
      step: 'link_created',
      source: getShareSource()
    })

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
        detail: error instanceof Error ? error.message : t('g.error')
      })
    }
  }
)
</script>
