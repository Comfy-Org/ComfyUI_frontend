<template>
  <span v-if="nodeDef.api_node && priceLabel">
    <CreditBadge :text="priceLabel" />
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import CreditBadge from '@/components/node/CreditBadge.vue'
import { evaluateNodeDefPricing } from '@/composables/node/useNodePricing'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { nodeDef } = defineProps<{
  nodeDef: ComfyNodeDefImpl
}>()

const priceLabel = ref('')

watch(
  () => nodeDef.name,
  (name) => {
    if (!nodeDef.api_node) {
      priceLabel.value = ''
      return
    }
    const capturedName = name
    evaluateNodeDefPricing(nodeDef)
      .then((label) => {
        if (nodeDef.name === capturedName) priceLabel.value = label
      })
      .catch((e) => {
        console.error('[NodePricingBadge] pricing evaluation failed:', e)
      })
  },
  { immediate: true }
)
</script>
