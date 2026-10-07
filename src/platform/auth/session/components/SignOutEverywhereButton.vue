<template>
  <Button
    v-if="webSession.signedInUser"
    variant="destructive-textonly"
    :loading="signingOut"
    @click="signOutEverywhere"
  >
    {{ $t('auth.signOutEverywhere.action') }}
  </Button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import {
  useCloudWebSessionStore,
  webSessionFailureMessage
} from '@/platform/auth/session/cloudWebSessionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

const { t } = useI18n()
const { logout } = useAuthActions()
const webSession = useCloudWebSessionStore()
const toastStore = useToastStore()
const signingOut = ref(false)

async function revokeAllSessions(): Promise<boolean> {
  const result = await webSession.revokeAllSessions()
  if (result.status === 'error') {
    toastStore.add({
      severity: 'error',
      summary: t('auth.signOutEverywhere.failed'),
      detail: webSessionFailureMessage(result.code),
      life: 8000
    })
    return false
  }
  toastStore.add({
    severity: 'success',
    summary: t('auth.signOutEverywhere.success'),
    detail: t('auth.signOutEverywhere.successDetail'),
    life: 5000
  })
  return true
}

async function signOutEverywhere() {
  signingOut.value = true
  try {
    await logout({ beforeSignOut: revokeAllSessions })
  } finally {
    signingOut.value = false
  }
}
</script>
