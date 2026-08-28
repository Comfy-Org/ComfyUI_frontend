<template>
  <BadgePill
    v-if="nodeDef.api_node && providerName"
    :text="providerName"
    :icon="getProviderIcon(providerName)"
    :border-style="getProviderBorderStyle(providerName)"
    :solid="isComfyCloud"
    :icon-class="isComfyCloud ? 'text-primary-comfy-ink' : undefined"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import BadgePill from '@/components/common/BadgePill.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import {
  getProviderBorderStyle,
  getProviderIcon,
  getProviderName,
  isComfyCloudProvider
} from '@/utils/categoryUtil'

const { nodeDef } = defineProps<{
  nodeDef: ComfyNodeDefImpl
}>()

const providerName = computed(() => getProviderName(nodeDef.category))
const isComfyCloud = computed(() => isComfyCloudProvider(providerName.value))
</script>
