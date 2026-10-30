<template>
  <a
    v-if="autoTopUpEnabled && canManageAutoTopUp"
    :href
    target="_blank"
    rel="noopener"
    class="flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
    @click="track"
  >
    {{ $t('credits.topUp.autoTopUpSettings') }}
    <i class="icon-[lucide--external-link]" />
  </a>
</template>

<script setup lang="ts">
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

const { autoTopUpEnabled, canManageAutoTopUp } = useBillingCapabilities()

const { href, track } = usePlatformHandoff('/profile/billing', {
  target: 'auto_top_up',
  action: 'manage'
})
</script>
