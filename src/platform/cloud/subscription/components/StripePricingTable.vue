<template>
  <div
    ref="tableContainer"
    class="relative w-full rounded-[20px] border border-interface-stroke bg-interface-panel-background"
  >
    <div
      v-if="!hasValidConfig"
      class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-text-secondary"
      data-testid="stripe-table-missing-config"
    >
      {{ $t('subscription.pricingTable.missingConfig') }}
    </div>
    <div
      v-else-if="loadError"
      class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-text-secondary"
      data-testid="stripe-table-error"
    >
      {{ $t('subscription.pricingTable.loadError') }}
    </div>
    <div
      v-else-if="!isReady"
      class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-text-secondary"
      data-testid="stripe-table-loading"
    >
      {{ $t('subscription.pricingTable.loading') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  getStripePricingTableConfig,
  hasStripePricingTableConfig
} from '@/config/stripePricingTableConfig'
import { useStripePricingTableLoader } from '@/platform/cloud/subscription/composables/useStripePricingTableLoader'

const props = defineProps<{
  pricingTableId?: string
  publishableKey?: string
}>()

const tableContainer = ref<HTMLDivElement | null>(null)
const isReady = ref(false)
const loadError = ref<string | null>(null)
const lastRenderedKey = ref('')
const stripeElement = ref<HTMLElement | null>(null)

const resolvedConfig = computed(() => {
  const fallback = getStripePricingTableConfig()

  return {
    publishableKey: props.publishableKey || fallback.publishableKey,
    pricingTableId: props.pricingTableId || fallback.pricingTableId
  }
})

const hasValidConfig = computed(() => {
  if (props.publishableKey && props.pricingTableId) return true
  return hasStripePricingTableConfig()
})

const { loadScript } = useStripePricingTableLoader()

const renderPricingTable = async () => {
  if (!tableContainer.value) return

  const { publishableKey, pricingTableId } = resolvedConfig.value
  if (!publishableKey || !pricingTableId) {
    return
  }

  const renderKey = `${publishableKey}:${pricingTableId}`
  if (renderKey === lastRenderedKey.value && isReady.value) {
    return
  }

  try {
    await loadScript()
    loadError.value = null
    if (!tableContainer.value) {
      return
    }
    if (stripeElement.value) {
      stripeElement.value.remove()
      stripeElement.value = null
    }
    const stripeTable = document.createElement('stripe-pricing-table')
    stripeTable.setAttribute('publishable-key', publishableKey)
    stripeTable.setAttribute('pricing-table-id', pricingTableId)
    stripeTable.style.display = 'block'
    stripeTable.style.width = '100%'
    stripeTable.style.minHeight = '420px'
    tableContainer.value.appendChild(stripeTable)
    stripeElement.value = stripeTable
    lastRenderedKey.value = renderKey
    isReady.value = true
  } catch (error) {
    console.error('[StripePricingTable] Failed to load pricing table', error)
    loadError.value = (error as Error).message
    isReady.value = false
  }
}

watch(
  [resolvedConfig, () => tableContainer.value],
  () => {
    if (!hasValidConfig.value) return
    if (!tableContainer.value) return
    void renderPricingTable()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stripeElement.value?.remove()
  stripeElement.value = null
})
</script>
