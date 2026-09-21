<script setup lang="ts">
/**
 * Invoices live with the payment provider, the same way the cloud app's
 * "Invoice History" opens the portal rather than listing them itself. The
 * portal returns to this page, which has nothing to refresh.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingClient } from '@comfyorg/account-ui/billing'

import HostedSurface from '@/components/HostedSurface.vue'
import { useHostedCopy } from '@/composables/useHostedCopy'

const { t } = useI18n()
const { coded } = useHostedCopy()
const { commands } = useBillingClient<'commands'>(undefined)

const opening = ref(false)
const failure = ref<string | undefined>()

async function openPortal() {
  opening.value = true
  failure.value = undefined
  const result = await commands.openPaymentPortal({
    returnUrl: window.location.href
  })
  opening.value = false
  if (result.status === 'error') {
    failure.value = coded('failure', result.code)
    return
  }
  window.location.assign(result.value.url)
}
</script>

<template>
  <HostedSurface>
    <section class="flex flex-col gap-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.invoices.body') }}
      </p>
      <p v-if="failure" class="m-0 text-sm text-destructive-background">
        {{ failure }}
      </p>
      <button
        type="button"
        :disabled="opening"
        class="h-11 cursor-pointer self-start rounded-lg bg-base-foreground px-5 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
        @click="openPortal"
      >
        {{ t('hosted.invoices.open') }}
      </button>
    </section>
  </HostedSurface>
</template>
