<template>
  <AppDialogPanel unpadded @close="dismiss">
    <template #title>
      {{ t('auth.sso.required.title') }}
    </template>

    <p class="m-0 p-4 text-sm text-muted-foreground">
      {{
        knownEmail
          ? t('auth.sso.required.bodyWithEmail', { email: knownEmail })
          : t('auth.sso.required.body')
      }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" @click="dismiss">
        {{ t('auth.sso.required.dismiss') }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        autofocus
        :loading="leaving"
        @click="continueWithSso"
      >
        {{ t('auth.sso.continueWithSso') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { SSO_REQUIRED_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { useContinueWithSso } from '@/platform/auth/sso/useContinueWithSso'
import { useDialogStore } from '@/stores/dialogStore'

const { email, returnTo, organizationId } = defineProps<{
  email?: string
  returnTo?: string
  organizationId?: string
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const { knownEmail, leaving, continueWithSso } = useContinueWithSso(() => ({
  email,
  returnTo,
  organizationId
}))

function dismiss() {
  dialogStore.closeDialog({ key: SSO_REQUIRED_DIALOG_KEY })
}
</script>
