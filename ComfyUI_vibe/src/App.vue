<script setup lang="ts">
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'

import { useUiStore } from '@/stores/uiStore'

// Initialize UI store to apply dark mode on app load
useUiStore()
</script>

<template>
  <div class="min-h-screen bg-surface-ground text-surface-900">
    <!-- Global components -->
    <Toast />
    <ConfirmDialog />

    <!-- Main content -->
    <RouterView />
  </div>
</template>

<style>
/* Dark mode color scheme */
.dark {
  color-scheme: dark;
}
</style>
