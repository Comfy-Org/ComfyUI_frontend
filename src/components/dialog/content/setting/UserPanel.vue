<template>
  <div class="user-settings-container h-full">
    <div class="flex h-full flex-col">
      <h2 class="mb-2 text-2xl font-bold">{{ $t('userSettings.title') }}</h2>
      <div class="mt-4 mb-3 border-t" />

      <div v-if="isLoggedIn" class="flex flex-col gap-2">
        <UserAvatar
          v-if="userPhotoUrl"
          :photo-url="userPhotoUrl"
          size="large"
        />

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.name') }}
          </h3>
          <div class="text-muted-foreground">
            {{ userDisplayName || $t('userSettings.notSet') }}
          </div>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.email') }}
          </h3>
          <span class="text-muted-foreground">
            {{ userEmail }}
          </span>
        </div>

        <div class="flex flex-col gap-0.5">
          <h3 class="font-medium">
            {{ $t('userSettings.provider') }}
          </h3>
          <div class="flex items-center gap-1 text-muted-foreground">
            <i :class="providerIcon" />
            {{ providerName }}
            <Button
              v-if="isEmailProvider"
              :tooltip="$t('userSettings.updatePassword')"
              variant="muted-textonly"
              size="icon-sm"
              :aria-label="$t('userSettings.updatePassword')"
              @click="onUpdatePassword"
            >
              <i class="pi pi-pen-to-square" />
            </Button>
          </div>
        </div>

        <AppSpinner v-if="loading" class="mt-4 size-8" />
        <div v-else class="mt-4 flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Button class="w-32" variant="secondary" @click="handleSignOut">
              <i class="pi pi-sign-out" />
              {{ $t('auth.signOut.signOut') }}
            </Button>
            <SignOutEverywhereButton />
          </div>
          <div class="flex flex-col items-start gap-1">
            <Button
              as="a"
              :href="accountDeletionUrl"
              target="_blank"
              rel="noopener noreferrer"
              variant="destructive-textonly"
              icon="icon-[lucide--trash-2]"
              class="no-underline"
              @click="trackAccountDeletionClick"
            >
              {{ $t('auth.deleteAccount.request') }}
            </Button>
            <p class="px-2 text-xs text-muted-foreground">
              {{ $t('auth.deleteAccount.description') }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col gap-4">
        <p class="text-muted-foreground">
          {{ $t('auth.login.title') }}
        </p>

        <Button class="w-52" variant="primary" :loading @click="handleSignIn">
          <i class="pi pi-user" />
          {{ $t('auth.login.signInOrSignUp') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import UserAvatar from '@/components/common/UserAvatar.vue'
import Button from '@comfyorg/design-system/button/Button'
import AppSpinner from '@/components/common/AppSpinner.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import SignOutEverywhereButton from '@/platform/auth/session/components/SignOutEverywhereButton.vue'
import { buildAccountDeletionUrl } from '@/platform/support/config'
import { useTelemetry } from '@/platform/telemetry'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useDialogService } from '@/services/dialogService'

const { t } = useI18n()
const router = useRouter()
const dialogService = useDialogService()
const { showUpdatePasswordDialog } = useAuthDialogs()
const {
  loading,
  isLoggedIn,
  isEmailProvider,
  needsFirebaseSignIn,
  userDisplayName,
  userEmail,
  userPhotoUrl,
  providerName,
  providerIcon,
  resolvedUserInfo,
  handleSignOut,
  handleSignIn
} = useCurrentUser()

const accountDeletionUrl = computed(() =>
  buildAccountDeletionUrl({
    name: userDisplayName.value,
    email: userEmail.value,
    id: resolvedUserInfo.value?.id
  })
)

function trackAccountDeletionClick() {
  useTelemetry()?.trackHelpResourceClicked({
    resource_type: 'account_deletion',
    is_external: true,
    source: 'user_panel'
  })
}

async function onUpdatePassword() {
  if (!needsFirebaseSignIn.value) {
    await showUpdatePasswordDialog()
    return
  }
  const confirmed = await dialogService.confirm({
    title: t('auth.reauthRequired.title'),
    message: t('auth.reauthRequired.message')
  })
  if (!confirmed) return
  const { href } = router.resolve({
    name: 'cloud-login',
    query: {
      switchAccount: 'true',
      previousFullPath: encodeURIComponent(router.currentRoute.value.fullPath)
    }
  })
  window.location.assign(href)
}
</script>
