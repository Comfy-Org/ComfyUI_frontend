<template>
  <div class="flex h-full items-center justify-center p-6">
    <div class="max-w-[100vw] text-center lg:w-[500px]">
      <h2 class="mb-3 text-xl text-foreground">{{ copy.heading }}</h2>
      <p class="mb-5 text-muted-foreground">{{ copy.detail }}</p>
      <RouterLink
        v-if="isSettled"
        :to="{ path: '/', query: route.query, hash: route.hash }"
        class="text-sm text-blue-400 no-underline"
      >
        {{ $t('desktopLogin.continueToCloud') }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import {
  desktopLoginRedemptionStatus,
  hasPendingDesktopLoginCode
} from '@/platform/cloud/onboarding/desktopLoginRedemption'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const hasNothingToApprove =
  !hasPendingDesktopLoginCode() && desktopLoginRedemptionStatus.value === 'idle'
if (hasNothingToApprove) {
  void router.replace({ path: '/', query: route.query, hash: route.hash })
}

const isSettled = computed(
  () =>
    !['idle', 'awaiting_approval', 'redeeming'].includes(
      desktopLoginRedemptionStatus.value
    )
)

onBeforeUnmount(() => {
  if (isSettled.value) desktopLoginRedemptionStatus.value = 'idle'
})

const copy = computed(() => {
  switch (desktopLoginRedemptionStatus.value) {
    case 'redeeming':
      return {
        heading: t('desktopLogin.redeemingSummary'),
        detail: t('desktopLogin.redeemingDetail')
      }
    case 'redeemed':
      return {
        heading: t('desktopLogin.successSummary'),
        detail: t('desktopLogin.successDetail')
      }
    case 'failed':
      return {
        heading: t('desktopLogin.failedSummary'),
        detail: t('desktopLogin.failedDetail')
      }
    case 'expired':
      return {
        heading: t('desktopLogin.expiredSummary'),
        detail: t('desktopLogin.expiredDetail')
      }
    case 'declined':
      return {
        heading: t('desktopLogin.declinedSummary'),
        detail: t('desktopLogin.declinedDetail')
      }
    case 'sso_unavailable':
      return {
        heading: t('desktopLogin.ssoUnavailableSummary'),
        detail: t('desktopLogin.ssoUnavailableDetail')
      }
    default:
      return {
        heading: t('desktopLogin.approvalPendingSummary'),
        detail: t('desktopLogin.approvalPendingDetail')
      }
  }
})
</script>
