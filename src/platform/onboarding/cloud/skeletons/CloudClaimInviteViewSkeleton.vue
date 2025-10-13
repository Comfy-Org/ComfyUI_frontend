<template>
  <div
    class="flex h-screen flex-col items-center justify-center gap-4 font-mono text-black"
  >
    <Skeleton width="60%" height="2rem" />
    <Skeleton width="30%" height="2.5rem" />
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
