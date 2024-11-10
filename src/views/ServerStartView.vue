<!-- This is a dummy page built for electron app only. -->
<!-- Replace this page with the electron side logic on installation & log streaming. -->
<template>
  <div
    class="absolute inset-0 flex flex-col items-center justify-center h-screen bg-surface-0"
  >
    <ProgressSpinner class="w-16 h-16 mb-4" />
    <div class="text-xl">{{ $t('loading') }}{{ counter }}</div>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { useInterval } from '@vueuse/core'

const counter = useInterval(1000)
</script>
