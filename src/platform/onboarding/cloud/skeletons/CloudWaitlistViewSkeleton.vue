<template>
  <div class="flex flex-col items-center justify-center p-8">
    <div class="w-full max-w-md text-center">
      <div class="mb-8">
        <Skeleton width="80%" height="3rem" class="mx-auto mb-2" />
        <Skeleton width="60%" height="3rem" class="mx-auto" />
      </div>
      <div class="mx-auto max-w-[320px]">
        <div class="mb-4">
          <Skeleton width="90%" height="1.5rem" class="mx-auto mb-2" />
          <Skeleton width="70%" height="1.5rem" class="mx-auto" />
        </div>
        <div>
          <Skeleton width="80%" height="1.5rem" class="mx-auto mb-2" />
          <div class="flex items-center justify-center gap-2">
            <Skeleton width="20%" height="1.5rem" />
            <Skeleton width="15%" height="1.5rem" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
