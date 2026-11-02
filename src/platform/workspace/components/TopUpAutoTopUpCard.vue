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
    >
      {{ $t('credits.topUp.autoTopUp.setUp') }}
      <i class="icon-[lucide--external-link]" aria-hidden="true" />
    </Button>
  </section>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { platformLink } from '@/platform/workspace/utils/platformLink'

const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
  useBillingCapabilities()

const canSetUp = computed(() => {
  if (!autoTopUpEnabled.value) return false
  if (!canManageAutoTopUp.value) return false
  const setup = autoTopUpSetup.value
  if (setup === null || setup.state === 'unavailable') return false
  return !(setup.state === 'frozen' && setup.reason === 'payment_past_due')
})

const autoReload = useAsyncState(
  () => workspaceApi.getBillingAutoReload(),
  null,
  {
    immediate: false,
    onError: (error) =>
      reportError(error, {
        errorType: 'auto_top_up_read_failed',
        surface: 'billing'
      })
  }
)

watch(
  canSetUp,
  (allowed) => {
    if (allowed && !autoReload.isReady.value) void autoReload.execute()
  },
  { immediate: true }
)

const visible = computed(() => {
  if (!canSetUp.value) return false
  return autoReload.state.value?.status === 'off'
})

const href = platformLink('/profile/billing')
</script>
