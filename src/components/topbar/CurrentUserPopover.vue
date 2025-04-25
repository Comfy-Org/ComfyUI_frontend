<!-- A popover that shows current user information and actions -->
<template>
  <div class="current-user-popover">
    <!-- User Info Section -->
    <div class="user-info p-3 border-b border-[var(--p-surface-border)]">
      <div class="flex items-center gap-3">
        <!-- User Avatar -->
        <div v-if="user?.photoURL" class="flex-shrink-0">
          <img
            :src="user.photoURL"
            :alt="user.displayName || ''"
            class="w-12 h-12 rounded-full"
          />
        </div>
        <div
          v-else
          class="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--p-surface-ground)]"
        >
          <i class="pi pi-user text-xl" />
        </div>

        <!-- User Details -->
        <div class="flex-grow min-w-0">
          <h3 class="text-lg font-semibold truncate">
            {{
              user?.displayName || user?.email || $t('userSettings.anonymous')
            }}
          </h3>
          <p
            v-if="user?.email"
            class="text-sm text-[var(--p-text-color-secondary)] truncate"
          >
            {{ user.email }}
          </p>
        </div>
      </div>
    </div>

    <!-- Actions Section -->
    <div class="actions p-2">
      <!-- Settings -->
      <button
        class="action-button w-full p-2 flex items-center gap-2 rounded-lg hover:bg-[var(--p-surface-hover)] transition-colors"
        @click="openUserSettings"
      >
        <i class="pi pi-cog" />
        <span>{{ $t('userSettings.title') }}</span>
      </button>

      <!-- Billing Portal -->
      <button
        v-if="isAuthenticated"
        class="action-button w-full p-2 flex items-center gap-2 rounded-lg hover:bg-[var(--p-surface-hover)] transition-colors"
        @click="openBillingPortal"
      >
        <i class="pi pi-credit-card" />
        <span>{{ $t('userSettings.billingPortal') }}</span>
      </button>

      <!-- Sign Out -->
      <button
        v-if="isAuthenticated"
        class="action-button w-full p-2 flex items-center gap-2 rounded-lg hover:bg-[var(--p-surface-hover)] transition-colors text-[var(--p-danger-color)]"
        @click="handleSignOut"
      >
        <i class="pi pi-sign-out" />
        <span>{{ $t('auth.signOut') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthService } from '@/services/firebaseAuthService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const authService = useFirebaseAuthService()
const dialogService = useDialogService()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.currentUser)

const openUserSettings = () => {
  dialogService.showSettingsDialog('user')
}

const openBillingPortal = async () => {
  await authService.accessBillingPortal()
}

const handleSignOut = async () => {
  await authService.logout()
}
</script>

<style scoped>
.current-user-popover {
  min-width: 280px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
  box-shadow: var(--p-overlay-shadow);
}

.action-button {
  color: var(--p-text-color);
  font-size: 0.875rem;
}
</style>
