<template>
  <div
    v-if="showStripePricingTable"
    class="flex flex-col gap-6 rounded-[24px] border border-interface-stroke bg-[var(--p-dialog-background)] p-4 shadow-[0_25px_80px_rgba(5,6,12,0.45)] md:p-6"
  >
    <div
      class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
    >
      <div class="flex flex-col gap-2 text-left md:max-w-2xl">
        <div
          class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary"
        >
          {{ $t('subscription.required.title') }}
          <CloudBadge
            reverse-order
            no-padding
            background-color="var(--p-dialog-background)"
            use-subscription
          />
        </div>
        <div class="text-3xl font-semibold leading-tight md:text-4xl">
          {{ $t('subscription.description') }}
        </div>
      </div>
      <Button
        icon="pi pi-times"
        text
        rounded
        class="h-10 w-10 shrink-0 text-text-secondary hover:bg-white/10"
        :aria-label="$t('g.close')"
        @click="handleClose"
      />
    </div>

    <StripePricingTable class="flex-1" />

    <!-- Contact and Enterprise Links -->
    <div class="flex flex-col items-center">
      <p class="text-sm text-text-secondary">
        {{ $t('subscription.haveQuestions') }}
      </p>
      <div class="flex items-center gap-2">
        <Button
          :label="$t('subscription.contactUs')"
          text
          severity="secondary"
          icon="pi pi-comments"
          icon-pos="right"
          class="h-6 p-1 text-sm text-text-secondary hover:text-white"
          @click="handleContactUs"
        />
        <span class="text-sm text-text-secondary">{{ $t('g.or') }}</span>
        <Button
          :label="$t('subscription.viewEnterprise')"
          text
          severity="secondary"
          icon="pi pi-external-link"
          icon-pos="right"
          class="h-6 p-1 text-sm text-text-secondary hover:text-white"
          @click="handleViewEnterprise"
        />
      </div>
    </div>
  </div>
  <div v-else class="legacy-dialog relative grid h-full grid-cols-5">
    <!-- Custom close button -->
    <Button
      icon="pi pi-times"
      text
      rounded
      class="absolute top-2.5 right-2.5 z-10 h-8 w-8 p-0 text-white hover:bg-white/20"
      :aria-label="$t('g.close')"
      @click="handleClose"
    />

    <div
      class="relative col-span-2 flex items-center justify-center overflow-hidden rounded-sm"
    >
      <video
        autoplay
        loop
        muted
        playsinline
        class="h-full min-w-[125%] object-cover p-0"
        style="margin-left: -20%"
      >
        <source
          src="/assets/images/cloud-subscription.webm"
          type="video/webm"
        />
      </video>
    </div>

    <div class="col-span-3 flex flex-col justify-between p-8">
      <div>
        <div class="flex flex-col gap-6">
          <div class="inline-flex items-center gap-2">
            <div class="text-sm text-muted text-text-primary">
              {{ $t('subscription.required.title') }}
            </div>
            <CloudBadge
              reverse-order
              no-padding
              background-color="var(--p-dialog-background)"
              use-subscription
            />
          </div>

          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-bold">{{ formattedMonthlyPrice }}</span>
            <span class="text-xl">{{ $t('subscription.perMonth') }}</span>
          </div>
        </div>

        <SubscriptionBenefits class="mt-6 text-muted" />
      </div>

      <div class="flex flex-col pt-8">
        <SubscribeButton
          class="py-2 px-4 rounded-lg"
          :pt="{
            root: {
              style: 'background: var(--color-accent-blue, #0B8CE9);'
            },
            label: {
              class: 'font-inter font-[700] text-sm'
            }
          }"
          @subscribed="handleSubscribed"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onBeforeUnmount, watch } from 'vue'

import CloudBadge from '@/components/topbar/CloudBadge.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import StripePricingTable from '@/platform/cloud/subscription/components/StripePricingTable.vue'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'

const props = defineProps<{
  onClose: () => void
}>()

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const { formattedMonthlyPrice, fetchStatus, isActiveSubscription } =
  useSubscription()
const { featureFlag } = useFeatureFlags()
const subscriptionTiersEnabled = featureFlag(
  'subscription_tiers_enabled',
  false
)
const commandStore = useCommandStore()
const telemetry = useTelemetry()

const showStripePricingTable = computed(
  () =>
    subscriptionTiersEnabled.value &&
    isCloud &&
    window.__CONFIG__?.subscription_required
)

const POLL_INTERVAL_MS = 3000
const MAX_POLL_DURATION_MS = 5 * 60 * 1000
let pollInterval: number | null = null
let pollStartTime = 0

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const startPolling = () => {
  stopPolling()
  pollStartTime = Date.now()

  const poll = async () => {
    try {
      await fetchStatus()
    } catch (error) {
      console.error(
        '[SubscriptionDialog] Failed to poll subscription status',
        error
      )
    }
  }

  void poll()
  pollInterval = window.setInterval(() => {
    if (Date.now() - pollStartTime > MAX_POLL_DURATION_MS) {
      stopPolling()
      return
    }
    void poll()
  }, POLL_INTERVAL_MS)
}

watch(
  showStripePricingTable,
  (enabled) => {
    if (enabled) {
      startPolling()
    } else {
      stopPolling()
    }
  },
  { immediate: true }
)

watch(
  () => isActiveSubscription.value,
  (isActive) => {
    if (isActive && showStripePricingTable.value) {
      emit('close', true)
      handleClose()
    }
  }
)

const handleSubscribed = () => {
  emit('close', true)
}

const handleClose = () => {
  stopPolling()
  props.onClose()
}

const handleContactUs = async () => {
  telemetry?.trackHelpResourceClicked({
    resource_type: 'help_feedback',
    is_external: true,
    source: 'subscription'
  })
  await commandStore.execute('Comfy.ContactSupport')
}

const handleViewEnterprise = () => {
  telemetry?.trackHelpResourceClicked({
    resource_type: 'docs',
    is_external: true,
    source: 'subscription'
  })
  window.open('https://www.comfy.org/cloud/enterprise', '_blank')
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.legacy-dialog :deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}

.legacy-dialog :deep(.p-button) {
  color: white;
}
</style>
