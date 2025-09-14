<template>
  <!-- Skeleton matching CloudLoginView exact layout -->
  <div class="h-full flex items-center justify-center p-8">
    <div class="w-96 p-2">
      <!-- Beta notice skeleton -->
      <div class="bg-[#2d2e32] p-4 rounded-lg mb-6">
        <Skeleton width="60%" height="1.125rem" class="mb-2" />
        <Skeleton width="90%" height="1rem" class="mb-2" />
        <Skeleton width="80%" height="1rem" />
      </div>

      <!-- Header skeleton -->
      <div class="flex flex-col gap-4 mt-6 mb-8">
        <Skeleton width="8rem" height="1.5rem" />
        <div class="flex items-center gap-1">
          <Skeleton width="10rem" height="1rem" />
          <Skeleton width="4rem" height="1rem" />
        </div>
      </div>

      <!-- Form skeleton -->
      <div class="flex flex-col gap-6 mb-8">
        <!-- Email field -->
        <div class="flex flex-col gap-2">
          <Skeleton width="3rem" height="1rem" class="mb-2" />
          <Skeleton width="100%" height="2.5rem" border-radius="0.375rem" />
        </div>

        <!-- Password field -->
        <div class="flex flex-col gap-2">
          <Skeleton width="4rem" height="1rem" class="mb-2" />
          <Skeleton width="100%" height="2.5rem" border-radius="0.375rem" />
          <Skeleton width="6rem" height="0.875rem" />
        </div>

        <!-- Submit button -->
        <Skeleton
          width="100%"
          height="2.5rem"
          border-radius="0.375rem"
          class="mt-4"
        />
      </div>

      <!-- Divider -->
      <div class="my-8 flex items-center">
        <Skeleton width="100%" height="1px" />
      </div>

      <!-- Social buttons -->
      <div class="flex flex-col gap-6">
        <Skeleton width="100%" height="2.5rem" border-radius="0.375rem" />
        <Skeleton width="100%" height="2.5rem" border-radius="0.375rem" />
      </div>

      <!-- Footer -->
      <div class="mt-5">
        <Skeleton width="80%" height="0.875rem" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
