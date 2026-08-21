<template>
  <div
    v-if="nudgeVariant"
    class="mr-2 inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary-background py-1 pr-1 pl-3"
    role="status"
    aria-live="polite"
    data-testid="email-verification-nudge"
  >
    <i
      class="icon-[lucide--mail-warning] size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
    <span class="text-xs whitespace-nowrap text-base-foreground">
      {{ message }}
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
      v-if="nudgeVariant === 'generic'"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="t('auth.emailVerification.dismiss')"
      data-testid="email-verification-dismiss"
      @click="dismiss"
    >
      <i class="icon-[lucide--x] size-4" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useEmailVerification } from '@/composables/auth/useEmailVerification'

const { t } = useI18n()
const { nudgeVariant, canResend, resend, dismiss } = useEmailVerification()

const message = computed(() =>
  nudgeVariant.value === 'credits'
    ? t('auth.emailVerification.creditsMessage')
    : t('auth.emailVerification.genericMessage')
)

function handleResend() {
  void resend()
}
</script>
