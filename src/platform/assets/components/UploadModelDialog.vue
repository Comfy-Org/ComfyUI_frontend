<template>
  <div class="upload-model-dialog flex flex-col gap-6 p-8">
    <div class="flex flex-col gap-2">
      <p class="text-base">
        {{ $t('assetBrowser.uploadModelDescription1') }}
      </p>
      <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>{{ $t('assetBrowser.uploadModelDescription2') }}</li>
        <li>{{ $t('assetBrowser.uploadModelDescription3') }}</li>
      </ul>
    </div>

    <form class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label for="civitai-link" class="font-medium">
          {{ $t('assetBrowser.civitaiLinkLabel') }}
        </label>
        <InputText
          id="civitai-link"
          v-model="modelLink"
          :placeholder="$t('assetBrowser.civitaiLinkPlaceholder')"
          class="w-full"
        />
        <small class="text-muted">
          {{ $t('assetBrowser.civitaiLinkExample') }}
        </small>
      </div>

      <div class="flex justify-end">
        <Button
          severity="primary"
          :label="$t('g.continue')"
          :disabled="!modelLink || isLoading"
          :loading="isLoading"
          @click="handleContinue"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { ref } from 'vue'

import { assetService } from '@/platform/assets/services/assetService'

const modelLink = ref('')
const isLoading = ref(false)

async function handleContinue() {
  if (!modelLink.value) return

  isLoading.value = true
  try {
    const metadata = await assetService.getAssetMetadata(modelLink.value)
    console.log('Metadata retrieved:', metadata)
    // TODO: Show metadata confirmation and proceed with upload
  } catch (error) {
    console.error('Failed to retrieve metadata:', error)
    // TODO: Show error message to user
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.upload-model-dialog {
  min-width: 600px;
  min-height: 400px;
}
</style>
