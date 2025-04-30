<template>
  <TabPanel value="User" class="user-settings-container h-full">
    <div class="flex flex-col h-full">
      <h2 class="text-2xl font-bold mb-2">{{ $t('userSettings.title') }}</h2>
      <Divider class="mb-3" />

      <div v-if="user" class="flex flex-col gap-2">
        <Avatar
          v-if="user.photoURL"
          :image="user.photoURL"
          shape="circle"
          size="large"
          aria-label="User Avatar"
        />

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.name') }}
          </h3>
          <div class="text-muted">
            {{ user.displayName || $t('userSettings.notSet') }}
          </div>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.email') }}
          </h3>
          <a :href="'mailto:' + user.email" class="hover:underline">
            {{ user.email }}
          </a>
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
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import TabPanel from 'primevue/tabpanel'
import { computed } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const dialogService = useDialogService()
const authStore = useFirebaseAuthStore()
const commandStore = useCommandStore()
const user = computed(() => authStore.currentUser)
const loading = computed(() => authStore.loading)

const providerName = computed(() => {
  const providerId = user.value?.providerData[0]?.providerId
  if (providerId?.includes('google')) {
    return 'Google'
  }
  if (providerId?.includes('github')) {
    return 'GitHub'
  }
  return providerId
})

const providerIcon = computed(() => {
  const providerId = user.value?.providerData[0]?.providerId
  if (providerId?.includes('google')) {
    return 'pi pi-google'
  }
  if (providerId?.includes('github')) {
    return 'pi pi-github'
  }
  return 'pi pi-user'
})

const isEmailProvider = computed(() => {
  const providerId = user.value?.providerData[0]?.providerId
  return providerId === 'password'
})

const handleSignOut = async () => {
  await commandStore.execute('Comfy.User.SignOut')
}

const handleSignIn = async () => {
  await commandStore.execute('Comfy.User.OpenSignInDialog')
}
</script>
