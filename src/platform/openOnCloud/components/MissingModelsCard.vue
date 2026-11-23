<template>
  <DeploymentDialogFrame
    data-testid="missing-models-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <DialogTitle class="my-0 pr-8 text-2xl/8 font-bold tracking-tight">
        {{ $t(copy.title, models.length) }}
      </DialogTitle>
      <p class="my-0 text-sm/5 text-muted-foreground" role="status">
        {{ $t(copy.description) }}
      </p>
      <ul class="my-0 flex list-none flex-col gap-1.5 p-0">
        <MissingModelRow
          v-for="model in models"
          :key="modelKey(model)"
          :model
          :pick="uploads.pickOf(model)"
          :size="uploads.sizeOf(model)"
          :choosable="canOfferNewFiles"
          :blocked="isPrepared ? uploads.blockedBy(model) : undefined"
          :locked="uploads.isUploading"
          @choose="(file) => uploads.choose(model, file)"
        />
      </ul>
      <p v-if="totalSize" class="my-0 text-sm text-muted-foreground">
        {{ $t('openOnCloud.missingModels.total', { size: totalSize }) }}
      </p>
      <div
        v-if="upload.phase === 'uploading'"
        class="flex flex-col gap-1.5"
        data-testid="missing-models-progress"
      >
        <div
          class="h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          :aria-valuenow="uploads.percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full bg-foreground transition-[width]"
            :style="{ width: `${uploads.percent}%` }"
          />
        </div>
        <p class="my-0 text-xs text-muted-foreground">
          {{ progressText }}
        </p>
      </div>
      <p
        v-else-if="upload.phase === 'failed'"
        class="my-0 text-sm text-destructive"
        role="alert"
      >
        {{ failureText(upload.reason, upload.message) }}
      </p>
      <footer class="flex justify-end gap-2.5 pt-3">
        <Button
          v-if="canReselectUnconfirmedFiles"
          variant="secondary"
          size="lg"
          @click="uploads.reselectUnconfirmedFiles"
        >
          {{ $t('openOnCloud.missingModels.chooseMissingFilesAgain') }}
        </Button>
        <Button
          v-if="canRecheck"
          variant="secondary"
          size="lg"
          @click="cloudCheck.check"
        >
          {{ $t('openOnCloud.missingModels.checkAgain') }}
        </Button>
        <Button
          v-if="showSecondary"
          variant="secondary"
          size="lg"
          @click="onSecondary"
        >
          {{ $t(SECONDARY_COPY[footer]) }}
        </Button>
        <Button
          v-if="footer !== 'close'"
          variant="inverted"
          size="lg"
          :data-testid="uploadButtonId"
          :disabled="uploadDisabled"
          @click="onPrimary"
        >
          {{ $t(primaryCopy) }}
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import MissingModelRow from '@/platform/openOnCloud/components/MissingModelRow.vue'
import {
  modelKey,
  useLocalModelUploadStore
} from '@/platform/openOnCloud/stores/localModelUploadStore'
import type {
  LocalModelUploadFailure,
  MissingModel
} from '@/platform/openOnCloud/stores/localModelUploadStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const {
  models,
  signedIn,
  recovering = false
} = defineProps<{
  models: MissingModel[]
  signedIn: boolean
  recovering?: boolean
}>()

const emit = defineEmits<{ dismiss: []; signIn: [] }>()

type Footer = 'uploading' | 'signIn' | 'upload' | 'close'

const SECONDARY_COPY: Record<Footer, string> = {
  uploading: 'openOnCloud.missingModels.cancelUpload',
  signIn: 'g.cancel',
  upload: 'g.cancel',
  close: 'g.close'
}

const PRIMARY_COPY: Record<Footer, string> = {
  uploading: 'openOnCloud.missingModels.hide',
  signIn: 'openOnCloud.missingModels.signInToUpload',
  upload: 'openOnCloud.missingModels.upload',
  close: 'g.close'
}

const FAILURE_COPY: Partial<Record<LocalModelUploadFailure, string>> = {
  accessDenied: 'assetBrowser.fileUpload.accessDenied',
  cancelled: 'openOnCloud.missingModels.cancelled',
  featureDisabled: 'assetBrowser.fileUpload.featureDisabled',
  privateModelsDisabled: 'assetBrowser.fileUpload.privateModelsDisabled',
  planUnavailable: 'assetBrowser.fileUpload.planUnavailable',
  sessionExpired: 'assetBrowser.fileUpload.sessionExpired',
  unsupportedFile: 'assetBrowser.fileUpload.notSafetensors',
  unsupportedType: 'openOnCloud.missingModels.folderUnsupported',
  accountChanged: 'openOnCloud.missingModels.accountChanged',
  confirmationPending: 'openOnCloud.missingModels.confirmationPending',
  storagePending: 'openOnCloud.missingModels.storagePending'
}

const { t } = useI18n()
const { flags } = useFeatureFlags()
const uploads = useLocalModelUploadStore()
const cloudCheck = useCloudWorkflowCheckStore()
const { upload: currentUpload, uploadFolders, owner } = storeToRefs(uploads)
const upload = computed(() => {
  const current = currentUpload.value
  if (current.phase === 'failed' && current.models) {
    const affectedModels = new Set(current.models.map(modelKey))
    if (
      models.length !== affectedModels.size ||
      !models.every((model) => affectedModels.has(modelKey(model)))
    )
      return { phase: 'idle' as const }
  }
  return current
})

watch(
  () =>
    [
      flags.openOnCloudModelUploadEnabled,
      signedIn,
      models,
      owner.value
    ] as const,
  () => {
    if (!flags.openOnCloudModelUploadEnabled) return
    uploads.reset(models, { freshVerdict: !recovering })
    if (signedIn) void uploads.prepare(models)
  },
  { immediate: true }
)

watch(
  () =>
    upload.value.phase === 'failed' && upload.value.reason === 'accountChanged',
  (accountChanged) => {
    if (accountChanged && signedIn && flags.openOnCloudModelUploadEnabled)
      void uploads.prepare(models)
  }
)

const isPrepared = computed(
  () =>
    flags.openOnCloudModelUploadEnabled &&
    signedIn &&
    uploadFolders.value !== null
)
const canOfferNewFiles = computed(
  () => isPrepared.value && models.length > 0 && models.every(uploads.canTake)
)
const finishOnly = computed(
  () => signedIn && uploads.canFinish(models) && !uploads.canSendAll(models)
)
const canOffer = computed(() => finishOnly.value || canOfferNewFiles.value)
const needsConfirmation = computed(
  () =>
    models.length > 0 &&
    models.every((model) => uploads.pickOf(model).status === 'stored')
)

const copy = computed(() => {
  if (finishOnly.value)
    return {
      title: 'openOnCloud.missingModels.confirmationTitle',
      description: 'openOnCloud.missingModels.confirmationDescription'
    }
  if (!flags.openOnCloudModelUploadEnabled)
    return {
      title: 'openOnCloud.missingModels.title',
      description: 'openOnCloud.missingModels.unavailable'
    }
  if (!signedIn)
    return {
      title: 'openOnCloud.missingModels.title',
      description: 'openOnCloud.missingModels.signedOut'
    }
  if (!isPrepared.value)
    return {
      title: 'openOnCloud.missingModels.title',
      description: 'openOnCloud.missingModels.preparing'
    }
  if (needsConfirmation.value)
    return {
      title: 'openOnCloud.missingModels.confirmationTitle',
      description: 'openOnCloud.missingModels.confirmationDescription'
    }
  if (canOffer.value)
    return {
      title: 'openOnCloud.missingModels.uploadTitle',
      description: 'openOnCloud.missingModels.chooseFiles'
    }
  return {
    title: 'openOnCloud.missingModels.title',
    description: 'openOnCloud.missingModels.unavailable'
  }
})

const footer = computed<Footer>(() => {
  if (upload.value.phase === 'uploading') return 'uploading'
  if (!flags.openOnCloudModelUploadEnabled)
    return finishOnly.value ? 'upload' : 'close'
  if (!signedIn) return 'signIn'
  return canOffer.value ? 'upload' : 'close'
})

const canRecheck = computed(
  () =>
    !recovering &&
    !needsConfirmation.value &&
    isPrepared.value &&
    !uploads.isUploading
)
const canReselectUnconfirmedFiles = computed(() => {
  const current = upload.value
  return (
    isPrepared.value &&
    current.phase === 'failed' &&
    !!current.unconfirmedModels?.length &&
    current.unconfirmedModels.every(
      (model) =>
        uploads.sizeOf(model) !== undefined && !uploads.blockedBy(model)
    )
  )
})
const showSecondary = computed(
  () => footer.value !== 'uploading' || uploads.canCancel
)
const uploadButtonId = computed(() =>
  footer.value === 'upload' ? 'missing-models-upload' : undefined
)
const uploadDisabled = computed(
  () => footer.value === 'upload' && !uploads.canUpload(models)
)
const primaryCopy = computed(() => {
  const current = upload.value
  if (
    footer.value === 'upload' &&
    (finishOnly.value || needsConfirmation.value)
  )
    return 'openOnCloud.missingModels.confirmUploads'
  if (
    footer.value === 'upload' &&
    current.phase === 'failed' &&
    (current.reason === 'storagePending' || current.reason === 'accessDenied')
  )
    return 'g.retry'
  return PRIMARY_COPY[footer.value]
})
const progressText = computed(() => {
  const current = upload.value
  if (current.phase !== 'uploading') return ''
  if (needsConfirmation.value) return t('openOnCloud.missingModels.confirming')
  if (!current.canCancel) return t('assetBrowser.fileUpload.saving')
  return t('openOnCloud.missingModels.progress', {
    sent: formatSize(current.sent),
    total: formatSize(current.total)
  })
})

const totalSize = computed(() => {
  if (!canOffer.value) return ''
  const bytes = models.reduce(
    (sum, model) => sum + (uploads.sizeOf(model) ?? 0),
    0
  )
  return bytes > 0 ? formatSize(bytes) : ''
})

function failureText(reason: LocalModelUploadFailure, message?: string) {
  const key = FAILURE_COPY[reason]
  if (key) return t(key)
  return message ?? t('openOnCloud.missingModels.failed')
}

function onSecondary() {
  if (footer.value === 'uploading') uploads.cancel()
  else emit('dismiss')
}

function onPrimary() {
  if (footer.value === 'uploading') emit('dismiss')
  else if (footer.value === 'signIn') emit('signIn')
  else if (footer.value === 'upload')
    void uploads.start(models, { refreshWorkflow: !recovering })
}
</script>
