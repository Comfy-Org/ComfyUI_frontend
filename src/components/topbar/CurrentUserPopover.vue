<!-- A popover that shows current user information and actions -->
<template>
  <div class="current-user-popover w-72">
    <!-- User Info Section -->
    <div class="p-3">
      <div class="flex flex-col items-center">
        <Avatar
          class="mb-3"
          :image="user?.photoURL ?? undefined"
          :icon="user?.photoURL ? undefined : 'pi pi-user'"
          shape="circle"
          size="large"
          aria-label="User Avatar"
        />

        <!-- User Details -->
        <h3 class="text-lg font-semibold truncate my-0 mb-1">
          {{ user?.displayName || $t('g.user') }}
        </h3>
        <p v-if="user?.email" class="text-sm text-muted truncate my-0">
          {{ user.email }}
        </p>
      </div>
    </div>

    <Divider class="my-2" />

    <Button
      :label="$t('auth.signOut.signOut')"
      icon="pi pi-sign-out"
      text
      fluid
      severity="secondary"
      @click="handleSignOut"
    />

    <Divider class="my-2" />

    <div class="w-full flex justify-between"></div>
  </div>
</template>

<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { computed } from 'vue'

import { useFirebaseAuthService } from '@/services/firebaseAuthService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const authService = useFirebaseAuthService()

const user = computed(() => authStore.currentUser)

const handleSignOut = async () => {
  await authService.logout()
}
</script>
