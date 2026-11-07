<template>
  <div
    v-if="isNudgeVisible"
    class="mr-2 inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary py-1 pr-1 pl-3"
    role="status"
    aria-live="polite"
    data-testid="email-verification-nudge"
  >
    <i
      class="icon-[lucide--mail-warning] text-muted-foreground"
      aria-hidden="true"
    />
    <span class="text-xs whitespace-nowrap text-foreground">
      {{ t('auth.emailVerification.genericMessage') }}
    </span>
    <Button
      variant="link"
      size="sm"
      :disabled="!canResend"
      data-testid="email-verification-resend"
      @click="handleResend"
    >
      {{ t('auth.emailVerification.resendButton') }}
    </Button>
    <Button
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="t('auth.emailVerification.dismiss')"
      data-testid="email-verification-dismiss"
      @click="dismiss"
    >
      <i class="icon-[lucide--x]" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useEmailVerification } from '@/composables/auth/useEmailVerification'

const { t } = useI18n()
const { isNudgeVisible, canResend, resend, dismiss } = useEmailVerification()

function handleResend() {
  void resend()
}
</script>
