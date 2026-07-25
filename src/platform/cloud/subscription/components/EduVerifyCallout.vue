<template>
  <div
    v-if="needsEduVerification"
    data-testid="edu-verify-callout"
    class="mx-auto flex w-full max-w-xl items-center gap-3 rounded-xl border border-border-default bg-base-background p-3 pl-4 text-left max-sm:flex-col max-sm:items-stretch"
  >
    <i
      class="pi pi-graduation-cap shrink-0 text-xl text-base-foreground max-sm:hidden"
      aria-hidden="true"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-sm font-semibold text-base-foreground">
        {{ $t('subscription.eduVerifyTitle') }}
      </span>
      <span class="text-xs text-muted-foreground">
        {{
          $t('subscription.eduVerifyHeader', {
            percent: EDU_MAX_DISCOUNT_PERCENT
          })
        }}
      </span>
      <span v-if="verifyStatusKey" role="alert" class="text-xs text-error">
        {{ $t(verifyStatusKey) }}
      </span>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Button
        v-if="!isSent"
        size="sm"
        variant="primary"
        :disabled="isSending"
        @click="handleSendVerification"
      >
        {{ $t('subscription.eduVerifySend') }}
      </Button>
      <template v-else>
        <span class="text-xs text-muted-foreground">
          {{ $t('subscription.eduVerifySentHint') }}
        </span>
        <Button
          size="sm"
          variant="primary"
          :disabled="isConfirmingVerification"
          @click="handleVerificationConfirmed"
        >
          {{ $t('subscription.eduVerifyConfirm') }}
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useEmailVerification } from '@/composables/auth/useEmailVerification'
import { useEduPricing } from '@/platform/cloud/subscription/composables/useEduPricing'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { EDU_MAX_DISCOUNT_PERCENT } from '@/platform/cloud/subscription/constants/tierPricing'
import { useAuthStore } from '@/stores/authStore'

const { needsEduVerification } = useEduPricing()
const { isSending, isSent, sendVerification, refreshVerification } =
  useEmailVerification()
const { fetchStatus } = useSubscription()
const authStore = useAuthStore()

type VerifyStatusKey =
  | 'subscription.eduVerifySendFailed'
  | 'subscription.eduVerifyStillUnverified'
  | 'subscription.eduVerifyFailed'

const isConfirmingVerification = ref(false)
const verifyStatusKey = ref<VerifyStatusKey | null>(null)

const handleSendVerification = async () => {
  verifyStatusKey.value = null
  if (!(await sendVerification())) {
    verifyStatusKey.value = 'subscription.eduVerifySendFailed'
  }
}

// Post-verification loop: refreshed token -> re-provision (ratchets is_edu) -> refetch status.
const handleVerificationConfirmed = async () => {
  if (isConfirmingVerification.value) return
  isConfirmingVerification.value = true
  verifyStatusKey.value = null
  try {
    const verified = await refreshVerification()
    if (!verified) {
      verifyStatusKey.value = 'subscription.eduVerifyStillUnverified'
      return
    }
    await authStore.createCustomer()
    await fetchStatus()
  } catch {
    verifyStatusKey.value = 'subscription.eduVerifyFailed'
  } finally {
    isConfirmingVerification.value = false
  }
}
</script>
