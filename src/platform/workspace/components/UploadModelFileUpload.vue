<template>
  <div class="flex min-h-0 flex-auto flex-col gap-6">
    <div
      class="flex min-h-0 flex-auto basis-0 flex-col gap-4 overflow-y-auto text-sm text-muted-foreground"
    >
      <div
        class="relative flex items-center gap-3 overflow-hidden rounded-lg bg-secondary px-4 py-3"
        v-bind="progressAttrs"
      >
        <div
          v-if="state.status === 'uploading'"
          class="pointer-events-none absolute inset-y-0 left-0 bg-primary/30 transition-[width]"
          :style="{ width: `${percent}%` }"
        />
        <i aria-hidden="true" class="relative icon-[lucide--box] size-5" />
        <div class="relative flex min-w-0 flex-1 flex-col gap-1">
          <p class="m-0 truncate text-foreground" :title="state.file.name">
            {{ title }}
          </p>
          <p class="m-0">{{ sizeText }}</p>
        </div>
      </div>

      <p
        v-if="state.status === 'failed'"
        role="alert"
        class="m-0 text-destructive"
      >
        {{ state.error }}
      </p>

      <div
        v-if="state.status === 'chosen' || state.status === 'failed'"
        class="flex flex-col gap-2"
      >
        <span>{{ $t('assetBrowser.modelTypeSelectorLabel') }}</span>
        <AppSingleSelect
          v-model="modelType"
          :label="
            isLoading
              ? $t('g.loading')
              : $t('assetBrowser.modelTypeSelectorPlaceholder')
          "
          :accessible-label="$t('assetBrowser.modelTypeSelectorLabel')"
          :options="typeOptions"
          :disabled="isLoading"
          data-attr="upload-model-file-type-selector"
        />
      </div>

      <p v-else-if="statusLine" class="m-0">
        {{ statusLine }}
      </p>

      <div v-else-if="state.status === 'done'" class="flex flex-col gap-2">
        <p class="m-0 font-bold text-foreground">
          {{ $t('assetBrowser.modelUploaded') }}
        </p>
        <p class="m-0">
          {{ $t('assetBrowser.findInLibrary', { type: modelTypeLabel }) }}
        </p>
      </div>
    </div>

    <div class="flex w-full shrink-0 justify-end gap-2">
      <Button
        v-if="canCancel"
        variant="secondary"
        size="lg"
        data-attr="upload-model-file-cancel-button"
        @click="emit('cancel')"
      >
        {{ $t('g.cancel') }}
      </Button>
      <Button
        v-else-if="state.status === 'saving'"
        variant="secondary"
        size="lg"
        data-attr="upload-model-file-close-button"
        @click="emit('close')"
      >
        {{ $t('g.close') }}
      </Button>
      <template v-else-if="state.status === 'done'">
        <Button
          variant="muted-textonly"
          size="lg"
          data-attr="upload-model-file-another-button"
          @click="emit('back')"
        >
          {{ $t('assetBrowser.importAnother') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          data-attr="upload-model-file-finish-button"
          @click="emit('close')"
        >
          {{ $t('assetBrowser.finish') }}
        </Button>
      </template>
      <template v-else>
        <Button
          variant="muted-textonly"
          size="lg"
          data-attr="upload-model-file-back-button"
          @click="emit('back')"
        >
          {{ $t('g.back') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          data-attr="upload-model-file-upload-button"
          :disabled="!modelType"
          @click="emit('upload')"
        >
          {{
            state.status === 'failed'
              ? $t('assetBrowser.fileUpload.tryAgain')
              : $t('assetBrowser.fileUpload.upload')
          }}
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppSingleSelect from '@/components/common/AppSingleSelect.vue'
import Button from '@/components/ui/button/Button.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { ModelFileUpload } from '@/platform/workspace/composables/useUploadModelFile'
import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'

const { state, folders } = defineProps<{
  state: Exclude<ModelFileUpload, { status: 'idle' }>
  folders: readonly string[]
}>()

const modelType = defineModel<string>({ required: true })

const emit = defineEmits<{
  upload: []
  cancel: []
  back: []
  close: []
}>()

const { t } = useI18n()
const { modelTypes, isLoading } = useModelTypes()

const percent = computed(() =>
  state.status === 'uploading' && state.file.size > 0
    ? Math.round((state.sent / state.file.size) * 100)
    : 0
)

const canCancel = computed(
  () => state.status === 'uploading' || state.status === 'stopping'
)

const statusLine = computed(() => {
  if (state.status === 'saving') return t('assetBrowser.fileUpload.saving')
  if (state.status === 'stopping') return t('assetBrowser.fileUpload.stopping')
  return undefined
})

const progressAttrs = computed(() =>
  state.status === 'uploading'
    ? {
        role: 'progressbar',
        'aria-label': title.value,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': percent.value
      }
    : {}
)

const title = computed(() =>
  state.status === 'uploading'
    ? t('assetBrowser.fileUpload.uploading', { name: state.file.name })
    : state.file.name
)

const sizeText = computed(() =>
  state.status === 'uploading'
    ? t('assetBrowser.fileUpload.progress', {
        sent: formatSize(state.sent),
        total: formatSize(state.file.size)
      })
    : formatSize(state.file.size)
)

const typeOptions = computed(() =>
  folders.map((value) => ({
    value,
    name: modelTypes.value.find((type) => type.value === value)?.name ?? value
  }))
)

const modelTypeLabel = computed(() => {
  const folder = state.status === 'done' ? state.modelType : modelType.value
  return (
    typeOptions.value.find((option) => option.value === folder)?.name ?? folder
  )
})
</script>
