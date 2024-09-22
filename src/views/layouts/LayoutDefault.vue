<template>
  <main class="LayoutDefault w-full min-h-screen overflow-hidden relative">
    <router-view />
  </main>

  <teleport to="#modals">
    <UserSelection id="comfy-user-selection" />
  </teleport>
</template>

<script setup lang="ts">
import UserSelection from '@/views/modals/UserSelection.vue'
</script>
