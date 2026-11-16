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
import Button from '@comfyorg/design-system/button/Button'
import { computed, watch } from 'vue'

import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
  useBillingCapabilities()
const { state, ensureRead } = useBillingAutoTopUpCard()

const canSetUp = computed(() => {
  if (!autoTopUpEnabled.value) return false
  if (!canManageAutoTopUp.value) return false
  const setup = autoTopUpSetup.value
  if (setup === null || setup.state === 'unavailable') return false
  return !(setup.state === 'frozen' && setup.reason === 'payment_past_due')
})

watch(
  canSetUp,
  (allowed) => {
    if (allowed) ensureRead()
  },
  { immediate: true }
)

const visible = computed(() => {
  if (!canSetUp.value) return false
  const read = state.value
  return read.kind === 'loaded' && read.settings.status === 'off'
})

const { href, track } = usePlatformHandoff('/profile/billing', {
  target: 'auto_top_up',
  action: 'turn_on'
})
</script>
