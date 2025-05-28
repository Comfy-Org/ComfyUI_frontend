<template>
  <TabPanel value="User" class="user-settings-container h-full">
    <div class="flex flex-col h-full">
      <h2 class="text-2xl font-bold mb-2">{{ $t('userSettings.title') }}</h2>
      <Divider class="mb-3" />

      <!-- Normal User Panel -->
      <div v-if="isLoggedIn" class="flex flex-col gap-2">
        <UserAvatar
          v-if="userPhotoUrl"
          :photo-url="userPhotoUrl"
          shape="circle"
          size="large"
        />

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.name') }}
          </h3>
          <div class="text-muted">
            {{ userDisplayName || $t('userSettings.notSet') }}
          </div>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.email') }}
          </h3>
          <span class="text-muted">
            {{ userEmail }}
          </span>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.provider') }}
          </h3>
          <div class="text-muted flex items-center gap-1">
            <i :class="providerIcon" />
            {{ providerName }}
            <Button
              v-if="isEmailProvider"
              v-tooltip="{
                value: $t('userSettings.updatePassword'),
                showDelay: 300
              }"
              icon="pi pi-pen-to-square"
              severity="secondary"
              text
              @click="dialogService.showUpdatePasswordDialog()"
            />
          </div>
        </div>

        <ProgressSpinner
          v-if="loading"
          class="w-8 h-8 mt-4"
          style="--pc-spinner-color: #000"
        />
        <Button
          v-else
          class="mt-4 w-32"
          severity="secondary"
          :label="$t('auth.signOut.signOut')"
          icon="pi pi-sign-out"
          @click="handleSignOut"
        />
      </div>

      <!-- Login Section -->
      <div v-else class="flex flex-col gap-4">
        <p class="text-gray-600">
          {{ $t('auth.login.title') }}
        </p>

        <Button
          class="w-52"
          severity="primary"
          :loading="loading"
          :label="$t('auth.login.signInOrSignUp')"
          icon="pi pi-user"
          @click="handleSignIn"
        />
      </div>
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import TabPanel from 'primevue/tabpanel'

import UserAvatar from '@/components/common/UserAvatar.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useDialogService } from '@/services/dialogService'

const dialogService = useDialogService()
const {
  loading,
  isLoggedIn,
  isEmailProvider,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  providerName,
  providerIcon,
  handleSignOut,
  handleSignIn
} = useCurrentUser()
</script>
