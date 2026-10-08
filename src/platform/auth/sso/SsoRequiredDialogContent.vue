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
        :loading="leaving"
        @click="continueWithSso"
      >
        {{ t('auth.sso.continueWithSso') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { ssoStartUrl } from '@comfyorg/account-core/sso'

import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { SSO_REQUIRED_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { toSsoReturnPath } from '@/platform/auth/sso/ssoReturnPath'
import { SSO_ENTRY_OPEN_QUERY } from '@/platform/cloud/onboarding/sso/ssoEntryQuery'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

const { email, returnTo, organizationId } = defineProps<{
  email?: string
  returnTo?: string
  organizationId?: string
}>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const dialogStore = useDialogStore()
const { toastErrorHandler } = useErrorHandling()
const knownEmail = computed(() => email ?? authStore.userEmail)
const leaving = ref(false)

function dismiss() {
  dialogStore.closeDialog({ key: SSO_REQUIRED_DIALOG_KEY })
}

function destination(): string {
  const back = {
    returnTo: toSsoReturnPath(returnTo ?? router.currentRoute.value.fullPath),
    origin: window.location.origin
  }
  if (organizationId) {
    return ssoStartUrl({
      organizationId,
      email: knownEmail.value ?? undefined,
      ...back
    })
  }
  if (!knownEmail.value) {
    return router.resolve({ name: 'cloud-login', query: SSO_ENTRY_OPEN_QUERY })
      .href
  }
  return ssoStartUrl({ email: knownEmail.value, ...back })
}

async function continueWithSso() {
  leaving.value = true
  const target = destination()
  try {
    if (authStore.currentUser) await authStore.logout()
  } catch (error) {
    leaving.value = false
    toastErrorHandler(error)
    return
  }
  window.location.assign(target)
}
</script>
