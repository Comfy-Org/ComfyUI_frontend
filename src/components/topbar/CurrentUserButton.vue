<!-- A button that shows current authenticated user's avatar -->
<template>
  <Button
    v-if="isAuthenticated"
    v-tooltip="{ value: $t('userSettings.title'), showDelay: 300 }"
    class="user-profile-button p-1"
    severity="secondary"
    text
    :aria-label="$t('userSettings.title')"
    @click="openUserSettings"
  >
    <div
      class="flex items-center gap-2 pr-2 rounded-full bg-[var(--p-content-background)]"
    >
      <!-- User Avatar if available -->
      <div v-if="user?.photoURL" class="flex items-center gap-1">
        <img
          :src="user.photoURL"
          :alt="user.displayName || ''"
          class="w-8 h-8 rounded-full"
        />
      </div>

      <!-- User Icon if no avatar -->
      <div v-else class="w-8 h-8 rounded-full flex items-center justify-center">
        <i class="pi pi-user text-sm" />
      </div>

      <i class="pi pi-chevron-down" :style="{ fontSize: '0.5rem' }" />
    </div>
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
const user = computed(() => authStore.currentUser)

const openUserSettings = () => {
  dialogService.showSettingsDialog('user')
}
</script>
