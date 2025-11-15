<template>
  <div class="flex flex-1 flex-col gap-6">
    <!-- Uploading State -->
    <div
      v-if="status === 'uploading'"
      class="flex flex-1 flex-col items-center justify-center gap-6"
    >
      <i
        class="icon-[lucide--loader-circle] animate-spin text-6xl text-primary"
      />
      <div class="text-center">
        <p class="m-0 text-sm font-bold">
          {{ $t('assetBrowser.uploadingModel') }}
        </p>
      </div>
    </div>

    <!-- Success State -->
    <div v-else-if="status === 'success'" class="flex flex-col gap-8">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted m-0 font-bold">
          {{ $t('assetBrowser.modelUploaded') }} 🎉
        </p>
        <p class="text-sm text-muted m-0">
          {{ $t('assetBrowser.findInLibrary', { type: modelType }) }}
        </p>
      </div>

      <div
        class="flex flex-row items-start p-8 bg-node-component-surface rounded-lg"
      >
        <div class="flex flex-col justify-center items-start gap-1 flex-1">
          <p class="text-sm m-0">
            {{ metadata?.name || metadata?.filename }}
          </p>
          <p class="text-sm text-muted m-0">
            {{ modelType }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="status === 'error'"
      class="flex flex-1 flex-col items-center justify-center gap-6"
    >
      <i class="icon-[lucide--x-circle] text-6xl text-red-500" />
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
interface ModelMetadata {
  content_length: number
  final_url: string
  content_type?: string
  filename?: string
  name?: string
  tags?: string[]
  preview_url?: string
}

defineProps<{
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
  metadata: ModelMetadata | null
  modelType: string
}>()
</script>
