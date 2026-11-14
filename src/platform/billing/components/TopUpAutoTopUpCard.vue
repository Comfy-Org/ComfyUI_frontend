<template>
  <section
    v-if="visible"
    class="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4"
  >
    <p class="m-0 text-sm text-foreground">
      {{ $t('credits.topUp.autoTopUp.prompt') }}
    </p>
    <Button
      as="a"
      :href
      target="_blank"
      rel="noopener"
      variant="secondary"
      size="md"
      class="shrink-0 no-underline"
      @click="track"
    >
      {{ $t('credits.topUp.autoTopUp.setUp') }}
      <i class="icon-[lucide--external-link]" aria-hidden="true" />
    </Button>
  </section>
</template>

<script setup lang="ts">
import { canSetUpAutoTopUp } from '@comfyorg/account-core/billing'
import Button from '@comfyorg/design-system/button/Button'
import { computed, watch } from 'vue'

import { useBillingAutoTopUpCard } from '@/platform/billing/legacy160/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import { platformAutoTopUpPath } from '@/platform/billing/platformAutoTopUpPath'

const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
  useBillingCapabilities()
const { state, ensureRead } = useBillingAutoTopUpCard()

const canSetUp = computed(() =>
  canSetUpAutoTopUp({
    autoTopUpEnabled: autoTopUpEnabled.value,
    canManageAutoTopUp: canManageAutoTopUp.value,
    setup: autoTopUpSetup.value
  })
)

watch(
  canSetUp,
  (allowed) => {
    if (allowed) ensureRead()
  },
  { immediate: true }
)

const { href, track, available } = usePlatformHandoff(
  platformAutoTopUpPath('turn_on'),
  {
    target: 'auto_top_up',
    action: 'turn_on'
  }
)

const visible = computed(() => {
  if (!available.value) return false
  if (!canSetUp.value) return false
  const read = state.value
  return read.kind === 'loaded' && read.settings.status === 'off'
})
</script>
