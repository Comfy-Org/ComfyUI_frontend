<template>
  <div class="flex flex-col gap-4">
    <Message severity="warning">
      {{
        knownEmail
          ? t('auth.sso.required.bodyWithEmail', { email: knownEmail })
          : t('auth.sso.required.body')
      }}
    </Message>
    <Button
      type="button"
      variant="brand-solid"
      size="brand"
      class="w-full gap-3"
      :loading="leaving"
      @click="continueWithSso"
    >
      <i class="icon-[lucide--building-2] size-5" aria-hidden="true" />
      {{ t('auth.sso.continueWithSso') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'
import { useContinueWithSso } from '@/platform/auth/sso/useContinueWithSso'

const { email, returnTo, organizationId } = defineProps<{
  email?: string
  returnTo?: string
  organizationId?: string
}>()

const { t } = useI18n()
const { knownEmail, leaving, continueWithSso } = useContinueWithSso(() => ({
  email,
  returnTo,
  organizationId
}))
</script>
