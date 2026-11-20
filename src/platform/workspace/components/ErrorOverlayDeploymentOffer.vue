<template>
  <ErrorOverlayDeploymentOfferRow v-if="isCloud" />
</template>

<script setup lang="ts">
import { isCloud } from '@/platform/distribution/types'
import ErrorOverlayDeploymentOfferRow from '@/platform/workspace/components/ErrorOverlayDeploymentOfferRow.vue'
</script>
