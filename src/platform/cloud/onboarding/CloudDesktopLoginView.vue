<template>
  <div class="flex h-full items-center justify-center p-6">
    <div class="max-w-[100vw] text-center lg:w-[500px]">
      <h2 class="mb-3 text-xl text-foreground">{{ heading }}</h2>
      <p class="mb-5 text-muted-foreground">{{ detail }}</p>
      <RouterLink
        v-if="showContinueLink"
        :to="{ path: '/' }"
        class="text-sm text-blue-400 no-underline"
      >
        {{ $t('desktopLogin.continueToCloud') }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import {
  desktopLoginRedemptionStatus,
  hasPendingDesktopLoginCode
} from '@/platform/cloud/onboarding/desktopLoginRedemption'

const { t } = useI18n()
const router = useRouter()

// Reached by hand with nothing to approve: there is no handoff to show.
if (
  !hasPendingDesktopLoginCode() &&
  desktopLoginRedemptionStatus.value === 'idle'
) {
  void router.replace({ path: '/' })
}

const isSettled = computed(
  () =>
    desktopLoginRedemptionStatus.value !== 'idle' &&
    desktopLoginRedemptionStatus.value !== 'awaiting_approval'
)

const heading = computed(() => {
  switch (desktopLoginRedemptionStatus.value) {
    case 'redeemed':
      return t('desktopLogin.successSummary')
    case 'failed':
      return t('desktopLogin.failedSummary')
    case 'expired':
    case 'declined':
      return t('desktopLogin.expiredSummary')
    default:
      return t('desktopLogin.approvalPendingSummary')
  }
})

const detail = computed(() => {
  switch (desktopLoginRedemptionStatus.value) {
    case 'redeemed':
      return t('desktopLogin.successDetail')
    case 'failed':
      return t('desktopLogin.failedDetail')
    case 'expired':
    case 'declined':
      return t('desktopLogin.expiredDetail')
    default:
      return t('desktopLogin.approvalPendingDetail')
  }
})

const showContinueLink = isSettled
</script>
