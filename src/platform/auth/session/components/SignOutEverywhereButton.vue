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
import { useToast } from '@/components/ui/toast'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import {
  useCloudWebSessionStore,
  webSessionFailureMessage
} from '@/platform/auth/session/cloudWebSessionStore'

const { t } = useI18n()
const { logout } = useAuthActions()
const webSession = useCloudWebSessionStore()
const toast = useToast()
const signingOut = ref(false)

async function revokeAllSessions(): Promise<boolean> {
  const result = await webSession.revokeAllSessions()
  if (result.status === 'error') {
    toast.error(t('auth.signOutEverywhere.failed'), {
      description: webSessionFailureMessage(result.code),
      duration: 8000
    })
    return false
  }
  toast.success(t('auth.signOutEverywhere.success'), {
    description: t('auth.signOutEverywhere.successDetail'),
    duration: 5000
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
