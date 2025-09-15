<template>
  <div
    class="flex flex-col justify-center items-center h-screen font-mono text-black gap-4"
  >
    <Skeleton width="60%" height="2rem" />
    <Skeleton width="30%" height="2.5rem" />
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
