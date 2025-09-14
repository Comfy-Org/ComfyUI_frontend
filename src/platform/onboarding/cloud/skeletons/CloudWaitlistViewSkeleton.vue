<template>
  <!-- Skeleton matching CloudWaitlistView exact layout -->
  <div class="flex flex-col items-center justify-center p-8">
    <div class="w-full max-w-md text-center">
      <!-- Main title skeleton matching "YOU'RE ON THE WAITLIST 🎉" -->
      <div class="mb-8">
        <Skeleton width="12rem" height="2.25rem" class="mb-1" />
        <Skeleton width="8rem" height="2.25rem" />
      </div>

      <!-- Message container skeleton -->
      <div class="max-w-[320px] text-lg font-light">
        <!-- First paragraph skeleton -->
        <div class="mb-4">
          <Skeleton width="90%" height="1.125rem" class="mb-2" />
          <Skeleton width="80%" height="1.125rem" class="mb-2" />
          <Skeleton width="70%" height="1.125rem" />
        </div>

        <!-- Second paragraph with link skeleton -->
        <div>
          <Skeleton width="85%" height="1.125rem" class="mb-2" />
          <Skeleton width="60%" height="1.125rem" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
