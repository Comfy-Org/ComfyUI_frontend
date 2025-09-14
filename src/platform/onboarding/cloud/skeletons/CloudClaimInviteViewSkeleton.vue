<template>
  <!-- Skeleton matching CloudClaimInviteView exact layout -->
  <div
    class="flex flex-col justify-center items-center h-screen font-mono text-black gap-4"
  >
    <!-- Title skeleton matching "Processing Invite Code..." -->
    <Skeleton width="16rem" height="2rem" class="text-2xl" />

    <!-- Button skeleton matching the claim button -->
    <Skeleton
      width="10rem"
      height="2.5rem"
      border-radius="0.375rem"
      class="px-4 py-2"
    />
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
