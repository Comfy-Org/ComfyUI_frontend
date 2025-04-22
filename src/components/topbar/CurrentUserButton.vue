<!-- A button that shows current authenticated user's avatar -->
<template>
  <Button
    v-if="isAuthenticated"
    v-tooltip="{ value: $t('userSettings.title'), showDelay: 300 }"
    class="flex-shrink-0 user-profile-button"
    severity="secondary"
    text
    :aria-label="$t('userSettings.title')"
    @click="openUserSettings"
  >
    <template #icon>
      <div
        class="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"
      >
        <i class="pi pi-user text-sm" />
      </div>
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const dialogService = useDialogService()
const isAuthenticated = computed(() => authStore.isAuthenticated)

const openUserSettings = () => {
  dialogService.showSettingsDialog('user')
}
</script>
