<template>
  <div class="flex flex-col items-center gap-4 p-4">
    <div class="flex flex-col items-center text-center">
      <i class="pi pi-exclamation-circle mb-4" style="font-size: 2rem" />
      <h2 class="text-2xl font-semibold mb-2">
        {{ $t(`auth.required.${type}.title`) }}
      </h2>
      <p class="text-gray-600 mb-4 max-w-md">
        {{ $t(`auth.required.${type}.message`) }}
      </p>
    </div>
    <div class="flex gap-4">
      <Button
        class="w-60"
        severity="primary"
        :label="$t(`auth.required.${type}.action`)"
        @click="openPanel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useDialogStore } from '@/stores/dialogStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const props = defineProps<{
  type: 'signIn' | 'credits'
}>()

const dialogStore = useDialogStore()
const authStore = useFirebaseAuthStore()

const openPanel = () => {
  // Close the current dialog
  dialogStore.closeDialog({ key: 'signin-required' })

  // Open user settings and navigate to appropriate panel
  if (props.type === 'credits') {
    authStore.openCreditsPanel()
  } else {
    authStore.openSignInPanel()
  }
}
</script>
