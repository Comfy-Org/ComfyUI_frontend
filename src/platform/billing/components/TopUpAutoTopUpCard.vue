<template>
  <section
    v-if="autoTopUpEnabled && canManageAutoTopUp"
    class="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <h3 class="m-0 text-sm font-medium text-foreground">
        {{ $t('credits.topUp.autoTopUp.title') }}
      </h3>
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('credits.topUp.autoTopUp.body') }}
      </p>
    </div>
    <Button
      as="a"
      :href
      target="_blank"
      rel="noopener"
      variant="secondary"
      size="md"
      class="shrink-0"
      @click="track"
    >
      {{ $t('credits.topUp.autoTopUp.setUp') }}
      <i class="icon-[lucide--external-link]" aria-hidden="true" />
    </Button>
  </section>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

const { autoTopUpEnabled, canManageAutoTopUp } = useBillingCapabilities()

const { href, track } = usePlatformHandoff('/profile/billing', {
  target: 'auto_top_up',
  action: 'turn_on'
})
</script>
