<template>
  <BadgePill
    :icon="getProviderIcon(partner)"
    :border-style="getProviderBorderStyle(partner)"
  />
</template>

<script setup lang="ts">
import BadgePill from '@/components/common/BadgePill.vue'
import { getProviderBorderStyle, getProviderIcon } from '@/utils/categoryUtil'

const { partner } = defineProps<{ partner: string }>()
</script>
