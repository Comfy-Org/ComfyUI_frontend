<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ t('auth.sso.required.title') }}
      </h2>
      <Button
        size="icon"
        variant="muted-textonly"
        :aria-label="t('g.close')"
        @click="dismiss"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>

    <p class="m-0 p-4 text-sm text-muted-foreground">
      {{
        knownEmail
          ? t('auth.sso.required.bodyWithEmail', { email: knownEmail })
          : t('auth.sso.required.body')
      }}
    </p>

    <div class="flex items-center justify-end gap-4 p-4">
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
    </div>
  </div>
</template>

<script setup lang="ts">
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
