<template>
  <div
    :class="
      cn(
        'flex flex-1 flex-col gap-6 text-sm text-muted-foreground',
        isTypeMismatchError && 'min-h-full justify-center'
      )
    "
  >
    <!-- Processing State (202 async download in progress) -->
    <div v-if="result === 'processing'" class="flex flex-col gap-2">
      <p class="m-0 font-bold">
        {{ $t('assetBrowser.processingModel') }}
      </p>
      <p class="m-0">
        {{ $t('assetBrowser.processingModelDescription') }}
      </p>

      <div
        class="flex flex-row items-center gap-3 rounded-lg bg-modal-card-background p-4"
      >
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="metadata?.filename || metadata?.name || 'Model preview'"
          class="size-14 shrink-0 rounded-sm object-cover"
        />
        <div
          class="flex min-w-0 flex-1 flex-col items-start justify-center gap-1"
        >
          <p class="m-0 w-full truncate text-base-foreground">
            {{ metadata?.filename || metadata?.name }}
          </p>
          <p class="m-0 text-sm text-muted">
            {{ modelType }}
          </p>
        </div>
      </div>
    </div>

    <!-- Success State -->
    <div v-else-if="result === 'success'" class="flex flex-col gap-2">
      <p class="m-0 font-bold">
        {{ $t('assetBrowser.modelUploaded') }}
      </p>
      <p class="m-0">
        {{ $t('assetBrowser.findInLibrary', { type: modelType }) }}
      </p>

      <div
        class="flex flex-row items-center gap-3 rounded-lg bg-modal-card-background p-4"
      >
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="metadata?.filename || metadata?.name || 'Model preview'"
          class="size-14 shrink-0 rounded-sm object-cover"
        />
        <div
          class="flex min-w-0 flex-1 flex-col items-start justify-center gap-1"
        >
          <p class="m-0 w-full truncate text-base-foreground">
            {{ metadata?.filename || metadata?.name }}
          </p>
          <p class="m-0 text-sm text-muted">
            {{ modelType }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="result === 'error'"
      class="flex flex-1 flex-col items-center justify-center gap-6"
    >
      <i
        aria-hidden="true"
        class="text-error"
        :class="
          typeMismatch
            ? 'icon-[lucide--circle-alert] size-12'
            : 'icon-[lucide--x-circle] size-16'
        "
      />
      <div
        v-if="typeMismatch"
        class="flex max-w-2xl flex-col gap-3 text-center"
      >
        <p class="m-0 text-sm font-bold">
          {{ $t('assetBrowser.missingModelImportTypeMismatchTitle') }}
        </p>
        <i18n-t
          keypath="assetBrowser.missingModelImportTypeMismatchAlreadyImported"
          tag="p"
          class="m-0 text-sm text-muted"
        >
          <template #actual>
            <span>{{ actualModelTypeLabel }}</span>
          </template>
        </i18n-t>
        <i18n-t
          keypath="assetBrowser.missingModelImportTypeMismatchRequired"
          tag="p"
          class="m-0 text-sm text-muted"
        >
          <template #required>
            <span>{{ typeMismatch.requiredModelTypeLabel }}</span>
          </template>
        </i18n-t>
        <i18n-t
          keypath="assetBrowser.missingModelImportTypeMismatchNextAction"
          tag="p"
          class="m-0 text-sm text-base-foreground"
        >
          <template #required>
            <span>{{ typeMismatch.requiredModelTypeLabel }}</span>
          </template>
        </i18n-t>
      </div>
      <div v-else class="text-center">
        <p class="m-0 text-sm font-bold">
          {{ $t('assetBrowser.uploadFailed') }}
        </p>
        <p v-if="error" class="mb-0 text-sm text-muted">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import type { UploadModelTypeMismatch } from '@/platform/assets/composables/useUploadModelWizard'

const { typeMismatch } = defineProps<{
  result: 'processing' | 'success' | 'error'
  error?: string
  metadata?: AssetMetadata
  modelType?: string
  previewImage?: string
  typeMismatch?: UploadModelTypeMismatch | null
}>()

const { t } = useI18n()
const isTypeMismatchError = computed(() => typeMismatch != null)
const actualModelTypeLabel = computed(
  () =>
    typeMismatch?.importedModelTypeLabel ??
    t('assetBrowser.missingModelImportUnknownType')
)
</script>
