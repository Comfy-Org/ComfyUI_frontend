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
      class="flex items-center rounded-full bg-[var(--p-content-background)]"
    >
      <Avatar
        :image="photoURL"
        :icon="photoURL ? undefined : 'pi pi-user'"
        shape="circle"
        aria-label="User Avatar"
      />

      <i class="pi pi-chevron-down px-1" :style="{ fontSize: '0.5rem' }" />
    </div>
  </Button>
</template>

<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import { computed } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const dialogService = useDialogService()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const photoURL = computed<string | undefined>(
  () => authStore.currentUser?.photoURL ?? undefined
)

const openUserSettings = () => {
  dialogService.showSettingsDialog('user')
}
</script>
