<template>
  <Message
    v-if="versionStore.shouldShowWarning"
    severity="warn"
    icon="pi pi-exclamation-triangle"
    class="my-2 mx-2"
    :closable="true"
    :pt="{
      root: { class: 'flex-col' },
      text: { class: 'flex-1' }
    }"
    @close="handleDismiss"
  >
    <div class="flex flex-col gap-3">
      <!-- Warning Message -->
      <div class="font-medium">
        {{ $t('versionMismatchWarning.title') }}
      </div>

      <!-- Version Details -->
      <div v-if="versionStore.warningMessage">
        <div v-if="versionStore.warningMessage.type === 'outdated'">
          {{
            $t('versionMismatchWarning.frontendOutdated', {
              frontendVersion: versionStore.warningMessage.frontendVersion,
              requiredVersion: versionStore.warningMessage.requiredVersion
            })
          }}
        </div>
        <div v-else-if="versionStore.warningMessage.type === 'newer'">
          {{
            $t('versionMismatchWarning.frontendNewer', {
              frontendVersion: versionStore.warningMessage.frontendVersion,
              backendVersion: versionStore.warningMessage.backendVersion
            })
          }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 justify-end">
        <Button
          v-if="versionStore.isFrontendOutdated"
          :label="$t('versionMismatchWarning.updateFrontend')"
          size="small"
          severity="warn"
          @click="handleUpdate"
        />
        <Button
          :label="$t('versionMismatchWarning.dismiss')"
          size="small"
          severity="secondary"
          @click="handleDismiss"
        />
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'

import { useVersionCompatibilityStore } from '@/stores/versionCompatibilityStore'

const versionStore = useVersionCompatibilityStore()

const handleDismiss = () => {
  void versionStore.dismissWarning()
}

const handleUpdate = () => {
  // Open ComfyUI documentation or update instructions
  window.open('https://docs.comfy.org/get_started/introduction', '_blank')
}
</script>

<style scoped>
/* Custom styles if needed */
</style>
