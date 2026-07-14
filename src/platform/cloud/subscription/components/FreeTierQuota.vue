<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

type FreeTierBalance = {
  allowance: number
  used: number
  remaining: number
}

const DOT_COLORS = [
  'bg-destructive-background',
  'bg-warning-background',
  'bg-success-background'
]

const { t } = useI18n()
const { flags } = useFeatureFlags()
const freeTierBalance = computed(() => {
  const { free_tier_balance: balance } = remoteConfig.value as {
    free_tier_balance?: FreeTierBalance
  }
  if (!balance || balance.allowance <= 0 || balance.remaining < 0) return
  return balance
})
const quotaEnabled = computed(
  () =>
    flags.freeTierJobAllowanceEnabled &&
    isAuthenticatedConfigLoaded.value &&
    freeTierBalance.value !== undefined
)
const available = computed(() => freeTierBalance.value?.remaining ?? 0)
const maxAvailable = computed(() => freeTierBalance.value?.allowance ?? 0)

const dotColor = computed(() => {
  const ratio = maxAvailable.value ? available.value / maxAvailable.value : 0
  return DOT_COLORS[
    Math.min(Math.floor(ratio * DOT_COLORS.length), DOT_COLORS.length - 1)
  ]
})
</script>
<template>
  <div
    v-if="quotaEnabled"
    class="pointer-events-auto mt-2 flex w-full items-center justify-between border-t border-border-subtle bg-comfy-menu-bg px-4 pt-2"
  >
    <div class="flex gap-2">
      <div
        v-for="index in maxAvailable"
        :key="index"
        :class="
          cn(
            'size-1.5 rounded-full',
            index > available ? 'bg-secondary-background-selected' : dotColor
          )
        "
      />
    </div>
    <div
      v-text="
        t('actionbar.freeTierRuns', {
          available,
          MAX_AVAILABLE: maxAvailable
        })
      "
    />
  </div>
</template>
