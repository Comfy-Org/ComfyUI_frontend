<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="max-w-[100vw] lg:w-96">
      <div class="rounded-lg bg-charcoal-500 p-4">
        <Skeleton class="mb-2 h-4.5 w-3/5" />
        <Skeleton class="mb-2 h-4 w-9/10" />
        <Skeleton class="h-4 w-4/5" />
      </div>

      <div class="mt-6 mb-8 flex flex-col gap-4">
        <Skeleton class="my-0 h-6 w-9/20" />
        <div class="flex items-center">
          <Skeleton class="mr-1 h-4 w-1/4" />
          <Skeleton class="h-4 w-1/5" />
        </div>
      </div>

      <div class="mb-8">
        <Skeleton class="mb-2 h-4 w-1/5" />
        <Skeleton class="mb-4 h-10 w-full" />
        <Skeleton class="mb-4 h-4 w-1/4" />
        <Skeleton class="mb-6 h-10 w-full" />
        <Skeleton class="mb-4 h-4 w-4/5" />
        <Skeleton class="h-10 w-full" />
      </div>

      <div class="my-8 flex items-center">
        <div class="flex-1 border-t border-gray-300"></div>
        <Skeleton class="mx-4 h-4 w-3/10" />
        <div class="flex-1 border-t border-gray-300"></div>
      </div>

      <div class="flex flex-col gap-6">
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-10 w-full" />
      </div>

      <div class="mt-5">
        <Skeleton class="h-3.5 w-7/10" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
</script>
