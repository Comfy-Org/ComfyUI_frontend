<template>
  <TabPanel value="User" class="user-settings-container h-full">
    <div class="flex flex-col h-full">
      <h2 class="text-xl font-bold mb-2">{{ $t('userSettings.title') }}</h2>
      <Divider class="mb-3" />

      <div class="flex flex-col gap-2">
        <!-- User Avatar if available -->
        <div v-if="user?.photoURL" class="flex items-center gap-2">
          <img
            :src="user.photoURL"
            :alt="user.displayName || ''"
            class="w-8 h-8 rounded-full"
          />
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="text-sm font-medium">
            {{ $t('userSettings.name') }}
          </h3>
          <div class="text-sm text-muted">
            {{ user?.displayName || $t('userSettings.notSet') }}
          </div>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="text-sm font-medium">
            {{ $t('userSettings.email') }}
          </h3>
          <a :href="'mailto:' + user?.email" class="text-sm hover:underline">
            {{ user?.email }}
          </a>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="text-sm font-medium">
            {{ $t('userSettings.provider') }}
          </h3>
          <div class="text-sm text-muted flex items-center gap-1">
            <i :class="providerIcon" class="text-xs" />
            {{ providerName }}
          </div>
        </div>

        <ProgressSpinner
          v-if="loading"
          class="w-8 h-8 mt-2"
          style="--pc-spinner-color: #000"
        />
        <Button
          v-else
          class="mt-3 w-32"
          severity="secondary"
          :label="$t('auth.signOut.signOut')"
          icon="pi pi-sign-out"
          @click="handleSignOut"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useToastStore } from '@/stores/toastStore'

const toast = useToastStore()
const { t } = useI18n()
const authStore = useFirebaseAuthStore()
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
  if (providerId?.includes('apple')) {
    return 'Apple'
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
  if (providerId?.includes('apple')) {
    return 'pi pi-apple'
  }
  return 'pi pi-user'
})

const handleSignOut = async () => {
  await authStore.logout()
  if (authStore.error) {
    toast.addAlert(authStore.error)
  } else {
    toast.add({
      severity: 'success',
      summary: t('auth.signOut.success'),
      detail: t('auth.signOut.successDetail'),
      life: 5000
    })
  }
}
</script>
