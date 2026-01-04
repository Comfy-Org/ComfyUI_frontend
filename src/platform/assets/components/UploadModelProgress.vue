<template>
  <div class="flex flex-1 flex-col gap-6 text-sm text-muted-foreground">
    <!-- Processing State (202 async download in progress) -->
    <div v-if="result === 'processing'" class="flex flex-col gap-2">
      <p class="m-0 font-bold">
        {{ $t('assetBrowser.processingModel') }}
      </p>
      <p class="m-0">
        {{ $t('assetBrowser.processingModelDescription') }}
      </p>

      <div
        class="flex flex-row items-center gap-3 p-4 bg-modal-card-background rounded-lg"
      >
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="metadata?.filename || metadata?.name || 'Model preview'"
          class="w-14 h-14 rounded object-cover flex-shrink-0"
        />
        <div class="flex flex-col justify-center items-start gap-1 flex-1">
          <p class="text-base-foreground m-0">
            {{ metadata?.filename || metadata?.name }}
          </p>
          <p class="text-sm text-muted m-0">
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
        class="flex flex-row items-center gap-3 p-4 bg-modal-card-background rounded-lg"
      >
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="metadata?.filename || metadata?.name || 'Model preview'"
          class="w-14 h-14 rounded object-cover flex-shrink-0"
        />
        <div class="flex flex-col justify-center items-start gap-1 flex-1">
          <p class="text-base-foreground m-0">
            {{ metadata?.filename || metadata?.name }}
          </p>
          <p class="text-sm text-muted m-0">
            <!-- Going to want to add another translation here to get a nice display name. -->
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
      <i class="icon-[lucide--x-circle] text-6xl text-error" />
      <div class="text-center">
        <p class="m-0 text-sm font-bold">
          {{ $t('assetBrowser.uploadFailed') }}
        </p>
        <p v-if="error" class="text-sm text-muted mb-0">
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'

const { result } = defineProps<{
  result: 'processing' | 'success' | 'error'
  error?: string
  metadata?: AssetMetadata
  modelType?: string
  previewImage?: string
}>()
</script>
