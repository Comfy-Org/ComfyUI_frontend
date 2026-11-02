<template>
  <DeploymentDialogFrame
    data-testid="upload-models-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <h2
        :id="titleId"
        class="my-0 pr-8 text-2xl/8 font-bold tracking-tight text-foreground"
      >
        {{
          isUploading
            ? $t('openOnCloud.uploadDialog.uploadingTitle', files.length)
            : $t('openOnCloud.uploadDialog.title', files.length)
        }}
      </h2>
      <p class="my-0 text-sm/5 text-muted-foreground">
        {{
          isUploading
            ? $t('openOnCloud.uploadDialog.uploadingBody')
            : $t('openOnCloud.uploadDialog.body')
        }}
      </p>
      <ul class="my-0 flex list-none flex-col gap-1.5 p-0">
        <li
          v-for="file in files"
          :key="file.model.name"
          class="flex flex-col gap-2 rounded-lg bg-secondary px-2.5 py-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <i
              :class="
                cn(
                  'size-3.5',
                  isUploading && isDone(file)
                    ? 'icon-[lucide--circle-check] text-success'
                    : 'icon-[lucide--package] text-muted-foreground'
                )
              "
              aria-hidden="true"
            />
            <span class="truncate text-foreground">{{ file.model.name }}</span>
            <span class="shrink-0 text-muted-foreground">
              {{ file.model.folder }}
            </span>
            <span class="ml-auto shrink-0 pl-2 text-muted-foreground">
              {{ fileStatus(file) }}
            </span>
          </div>
          <ProgressBar
            v-if="isUploading && !isDone(file)"
            :percent="(file.uploadedBytes / file.model.bytes) * 100"
            class="h-0.5"
          />
        </li>
      </ul>
      <div
        v-if="upload.phase === 'uploading'"
        class="flex flex-col gap-2 text-xs text-muted-foreground"
      >
        <div class="flex items-center justify-between gap-2">
          <span>{{ progressLabel(upload.uploadedBytes, totalSize) }}</span>
          <span>
            {{ $t('openOnCloud.uploadDialog.percent', { percent }) }}
          </span>
        </div>
        <ProgressBar :percent class="h-1" />
      </div>
      <p v-else class="my-0 text-xs text-muted-foreground">
        {{
          $t('openOnCloud.uploadDialog.total', {
            size: formatBytes(locale, totalSize)
          })
        }}
      </p>
      <footer class="flex items-center justify-end gap-2.5 pt-3">
        <template v-if="isUploading">
          <Button variant="secondary" size="lg" @click="cancelUpload">
            {{ $t('openOnCloud.uploadDialog.cancelUpload') }}
          </Button>
          <Button variant="inverted" size="lg" @click="emit('done')">
            {{ $t('openOnCloud.uploadDialog.hide') }}
          </Button>
        </template>
        <template v-else>
          <Button variant="secondary" size="lg" @click="emit('dismiss')">
            {{ $t('g.cancel') }}
          </Button>
          <Button
            v-if="signInToUpload"
            variant="inverted"
            size="lg"
            data-testid="upload-models-sign-in"
            @click="signInStore.signIn()"
          >
            {{ $t('openOnCloud.uploadDialog.signInToUpload') }}
          </Button>
          <Button
            v-else
            variant="inverted"
            size="lg"
            data-testid="upload-models-start"
            @click="uploadStore.start(models)"
          >
            {{ $t('openOnCloud.uploadDialog.upload') }}
          </Button>
        </template>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { CloudMissingModel } from '@/platform/openOnCloud/cloudWorkflowCheck'
import ProgressBar from '@/platform/openOnCloud/components/ProgressBar.vue'
import type { ModelUploadFile } from '@/platform/openOnCloud/modelUpload'
import {
  formatBytes,
  totalBytes,
  uploadFiles,
  uploadPercent
} from '@/platform/openOnCloud/modelUpload'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { models, signInToUpload } = defineProps<{
  titleId?: string
  models: CloudMissingModel[]
  signInToUpload: boolean
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { t, locale } = useI18n()
const uploadStore = useModelUploadStore()
const signInStore = useLocalSignInStore()
const { state: upload } = storeToRefs(uploadStore)

const isUploading = computed(() => upload.value.phase === 'uploading')
const uploadedBytes = computed(() =>
  upload.value.phase === 'uploading' ? upload.value.uploadedBytes : 0
)
const files = computed(() => uploadFiles(models, uploadedBytes.value))
const totalSize = computed(() => totalBytes(models))
const percent = computed(() => uploadPercent(models, uploadedBytes.value))

function isDone(file: ModelUploadFile): boolean {
  return file.uploadedBytes >= file.model.bytes
}

function progressLabel(done: number, total: number): string {
  return t('openOnCloud.uploadDialog.progress', {
    done: formatBytes(locale.value, done, {
      scaleBytes: total,
      withUnit: false
    }),
    total: formatBytes(locale.value, total)
  })
}

function fileStatus(file: ModelUploadFile): string {
  if (!isUploading.value) return formatBytes(locale.value, file.model.bytes)
  if (isDone(file)) return t('openOnCloud.uploadDialog.uploaded')
  return progressLabel(file.uploadedBytes, file.model.bytes)
}

function cancelUpload() {
  uploadStore.cancel()
  emit('dismiss')
}
</script>
