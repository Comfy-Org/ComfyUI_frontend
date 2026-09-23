<script setup lang="ts">
import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import {
  usePaymentMethods,
  useBillingClient
} from '@comfyorg/account-ui/billing'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useHostedCopy } from '@/composables/useHostedCopy'

/** Marks the customer's trip back from the provider's hosted portal. */
const PORTAL_PARAM = 'portal'
const PORTAL_RETURN = 'return'

const { t } = useI18n()
const { coded } = useHostedCopy()
const route = useRoute()
const router = useRouter()
const { commands } = useBillingClient<'commands'>(undefined)

const returningFromPortal = route.query[PORTAL_PARAM] === PORTAL_RETURN

const { methods, defaultMethod, loading, failure, invalidateAndRefresh } =
  usePaymentMethods({ immediate: !returningFromPortal })

const portalFailure = ref<string | undefined>()
const openingPortal = ref(false)

const rows = computed(() =>
  (methods.value ?? []).map((method) => ({
    id: method.id,
    label: describe(method),
    isDefault: method.id === defaultMethod.value?.id
  }))
)

function describe(method: SavedPaymentMethod): string {
  if (method.brand === undefined || method.last4 === undefined)
    return coded('paymentMethodType', method.type)
  return t('hosted.paymentMethods.card', {
    brand: method.brand,
    last4: method.last4
  })
}

function portalReturnUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.set(PORTAL_PARAM, PORTAL_RETURN)
  return url.href
}

async function openPortal() {
  openingPortal.value = true
  portalFailure.value = undefined
  const result = await commands.openPaymentPortal({
    returnUrl: portalReturnUrl()
  })
  openingPortal.value = false
  if (result.status === 'error') {
    portalFailure.value = coded('failure', result.code)
    return
  }
  window.location.assign(result.value.url)
}

async function resumeFromPortal() {
  await invalidateAndRefresh()
  await router.replace({
    path: route.path,
    query: Object.fromEntries(
      Object.entries(route.query).filter(([key]) => key !== PORTAL_PARAM)
    )
  })
}

if (returningFromPortal) void resumeFromPortal()
</script>

<template>
  <section class="flex flex-col gap-4">
    <p v-if="loading" class="m-0 text-sm text-muted-foreground">
      {{ t('hosted.loading') }}
    </p>
    <p v-if="failure" class="m-0 text-sm text-destructive-background">
      {{ coded('failure', failure.code) }}
    </p>
    <p
      v-if="!loading && !failure && rows.length === 0"
      class="m-0 text-sm text-muted-foreground"
    >
      {{ t('hosted.paymentMethods.empty') }}
    </p>

    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-secondary-background px-4 py-3"
      >
        <span class="text-sm text-base-foreground">{{ row.label }}</span>
        <span v-if="row.isDefault" class="text-xs text-muted-foreground">
          {{ t('hosted.paymentMethods.default') }}
        </span>
      </li>
    </ul>

    <p v-if="portalFailure" class="m-0 text-sm text-destructive-background">
      {{ portalFailure }}
    </p>
    <button
      type="button"
      :disabled="openingPortal"
      class="h-11 cursor-pointer self-start rounded-lg bg-base-foreground px-5 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
      @click="openPortal"
    >
      {{ t('hosted.paymentMethods.manage') }}
    </button>
  </section>
</template>
