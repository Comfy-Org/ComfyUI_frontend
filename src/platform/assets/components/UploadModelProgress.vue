<template>
  <div class="flex flex-col gap-6">
    <!-- Uploading State -->
    <div
      v-if="status === 'uploading'"
      class="flex flex-col items-center justify-center gap-6 py-8"
    >
      <i
        class="icon-[lucide--loader-circle] animate-spin text-6xl text-primary"
      />
      <div class="text-center">
        <h3 class="mb-2 text-lg font-semibold">
          {{ $t('assetBrowser.uploadingModel') }}
        </h3>
      </div>
    </div>

    <!-- Success State -->
    <div v-else-if="status === 'success'" class="flex flex-col gap-6">
      <div class="flex items-start gap-2">
        <h3 class="text-sm text-muted mb-0">
          {{ $t('assetBrowser.modelUploaded') }} 🎉
        </h3>
      </div>

      <p class="text-sm text-muted">
        {{ $t('assetBrowser.findInLibrary', { type: modelType.toUpperCase() }) }}
      </p>

      <div class="flex items-center gap-3 rounded-lg bg-surface-hover p-4">
        <img
          v-if="metadata?.preview_url"
          :src="metadata.preview_url"
          :alt="metadata?.name"
          class="size-16 rounded object-cover"
        />
        <div
          v-else
          class="flex size-16 items-center justify-center rounded bg-surface"
        >
          <i class="icon-[lucide--image] text-2xl text-muted" />
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-base font-medium">
            {{ metadata?.name || metadata?.filename }}
          </p>
          <p class="text-sm text-muted">
            {{ modelType.toUpperCase() }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="status === 'error'"
      class="flex flex-col items-center justify-center gap-6 py-8"
    >
      <i class="icon-[lucide--x-circle] text-6xl text-red-500" />
      <div class="text-center">
        <h3 class="mb-2 text-lg font-semibold">
          {{ $t('assetBrowser.uploadFailed') }}
        </h3>
        <p v-if="error" class="text-sm text-muted">
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
