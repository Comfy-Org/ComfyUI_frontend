<template>
  <DeploymentDialogFrame
    data-testid="missing-models-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <DialogTitle class="my-0 pr-8 text-2xl/8 font-bold tracking-tight">
        {{ $t(copy.title, models.length) }}
      </DialogTitle>
      <p class="my-0 text-sm/5 text-muted-foreground">
        {{ $t(copy.description) }}
      </p>
      <ul class="my-0 flex list-none flex-col gap-1.5 p-0">
        <MissingModelRow
          v-for="model in models"
          :key="modelKey(model)"
          :model
          :pick="uploads.pickOf(model)"
          :size="uploads.sizeOf(model)"
          :choosable="canOffer && uploads.canTake(model)"
          :blocked="canOffer ? blockedBy(model) : undefined"
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
          {{
            $t('openOnCloud.missingModels.progress', {
              sent: formatSize(upload.sent),
              total: formatSize(upload.total)
            })
          }}
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
          variant="secondary"
          size="lg"
          @click="footer === 'uploading' ? uploads.cancel() : emit('dismiss')"
        >
          {{ $t(SECONDARY_COPY[footer]) }}
        </Button>
        <Button
          v-if="footer !== 'close'"
          variant="inverted"
          size="lg"
          :data-testid="
            footer === 'upload' ? 'missing-models-upload' : undefined
          "
          :disabled="footer === 'upload' && !uploads.canUpload(models)"
          @click="onPrimary"
        >
          {{ $t(PRIMARY_COPY[footer]) }}
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
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import MissingModelRow from '@/platform/openOnCloud/components/MissingModelRow.vue'
import {
  keepsModelPath,
  modelKey,
  useLocalModelUploadStore
} from '@/platform/openOnCloud/stores/localModelUploadStore'
import type {
  LocalModelUploadFailure,
  MissingModel
} from '@/platform/openOnCloud/stores/localModelUploadStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { models, signedIn } = defineProps<{
  models: MissingModel[]
  signedIn: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()

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
  cancelled: 'openOnCloud.missingModels.cancelled',
  privateModelsDisabled: 'assetBrowser.fileUpload.privateModelsDisabled',
  planUnavailable: 'assetBrowser.fileUpload.planUnavailable',
  sessionExpired: 'assetBrowser.fileUpload.sessionExpired',
  unsupportedFile: 'assetBrowser.fileUpload.notSafetensors',
  unsupportedType: 'openOnCloud.missingModels.folderUnsupported',
  accountChanged: 'openOnCloud.missingModels.accountChanged'
}

const { t } = useI18n()
const uploads = useLocalModelUploadStore()
const { upload, uploadFolders } = storeToRefs(uploads)

watch(
  () => [signedIn, models] as const,
  () => {
    uploads.reset()
    if (signedIn) void uploads.prepare(models)
  },
  { immediate: true }
)

const canOffer = computed(
  () =>
    signedIn &&
    uploadFolders.value !== null &&
    models.some((model) => uploads.canTake(model))
)

const copy = computed(() => {
  if (!signedIn)
    return {
      title: 'openOnCloud.missingModels.title',
      description: 'openOnCloud.missingModels.signedOut'
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
  if (!signedIn) return 'signIn'
  return canOffer.value ? 'upload' : 'close'
})

const totalSize = computed(() => {
  if (!canOffer.value) return ''
  const bytes = models.reduce(
    (sum, model) => sum + (uploads.sizeOf(model) ?? 0),
    0
  )
  return bytes > 0 ? formatSize(bytes) : ''
})

function blockedBy(model: MissingModel) {
  if (!uploads.takesFolder(model.folder)) return 'folder'
  return keepsModelPath(model) ? undefined : 'subfolder'
}

function failureText(reason: LocalModelUploadFailure, message?: string) {
  const key = FAILURE_COPY[reason]
  if (key) return t(key)
  return message ?? t('openOnCloud.missingModels.failed')
}

function onPrimary() {
  if (footer.value === 'uploading') emit('dismiss')
  else if (footer.value === 'signIn') void useAuthDialogs().showSignInDialog()
  else void uploads.start(models)
}
</script>
