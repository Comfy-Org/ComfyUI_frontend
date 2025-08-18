<template>
  <Button
    v-show="isRefreshable"
    severity="info"
    text
    icon="pi pi-refresh"
    @click="refreshSelected"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useRefreshableSelection } from '@/composables/useRefreshableSelection'

const { isRefreshable, refreshSelected } = useRefreshableSelection()
</script>
