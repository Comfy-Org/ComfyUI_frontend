<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BillingReturn } from '@comfyorg/billing-contract'
import { buildReturnUrl } from '@comfyorg/billing-contract'

import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { BILLING_WEB_ENV } from '@/config/env'
import { useBillingEntry } from '@/entry/billingEntry'
import { useBillingWebSession } from '@/session/billingWebSession'

/** What the trip back should say, when the surface has a result to report. */
const { returnResult } = defineProps<{ returnResult?: BillingReturn }>()

const { t } = useI18n()
const { coded } = useHostedCopy()
const { entry, error } = useBillingEntry()
const { session } = useBillingWebSession()
const billedWorkspace = useBilledWorkspace()

const title = computed(() => coded('title', entry.value?.intent))

/** Which workspace is being billed, when the session names one. */
const workspaceLabel = computed(() =>
  session.value
    ? t('hosted.workspace.current', { name: session.value.workspace.name })
    : undefined
)

const returnLink = computed(() => {
  const arrival = entry.value
  if (!arrival) return undefined
  const url = buildReturnUrl({
    target: arrival.returnTo,
    environment: BILLING_WEB_ENV,
    workspace: billedWorkspace(),
    ...returnResult
  })
  if (!url) return undefined
  return {
    href: url.href,
    label: t('hosted.returnTo', {
      product: coded('product', arrival.product)
    })
  }
})
</script>

<template>
  <main
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h1 class="m-0 text-xl font-semibold text-base-foreground">
            {{ title }}
          </h1>
          <p v-if="workspaceLabel" class="m-0 text-xs text-muted-foreground">
            {{ workspaceLabel }}
          </p>
        </div>
        <a
          v-if="returnLink"
          :href="returnLink.href"
          class="text-sm text-muted-foreground underline underline-offset-4 hover:text-base-foreground"
        >
          {{ returnLink.label }}
        </a>
      </header>

      <section
        v-if="error"
        class="rounded-xl border border-border-subtle bg-secondary-background p-6"
      >
        <h2 class="m-0 text-base font-semibold text-base-foreground">
          {{ t('hosted.entryError.title') }}
        </h2>
        <p class="mt-2 mb-0 text-sm text-muted-foreground">
          {{ coded('entryError', error) }}
        </p>
      </section>
      <slot v-else />
    </div>
  </main>
</template>
