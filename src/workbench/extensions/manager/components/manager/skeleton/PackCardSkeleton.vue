<template>
  <div
    class="flex h-full flex-col overflow-hidden rounded-lg shadow-sm"
    data-virtual-grid-item
  >
    <!-- Card header - flush with top, approximately 15% of height -->
    <div class="flex w-full items-center justify-between px-4 py-3">
      <div class="flex items-center">
        <div class="flex size-6 items-center justify-center">
          <Skeleton class="size-6 rounded-full" />
        </div>
        <Skeleton class="ml-2 h-4 w-20" />
      </div>
      <Skeleton class="h-7 w-16 rounded-xl" />
    </div>

    <!-- Card content with icon on left and text on right -->
    <div class="flex flex-1 p-4">
      <!-- Left icon - 64x64 -->
      <div class="mr-4 shrink-0">
        <Skeleton class="size-16 rounded-lg" />
      </div>

      <!-- Right content -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Title -->
        <Skeleton class="mb-2 h-4 w-4/5" />

        <!-- Description -->
        <div class="mb-3">
          <Skeleton class="mb-1 h-3 w-full" />
          <Skeleton class="mb-1 h-3 w-19/20" />
          <Skeleton class="h-3 w-9/10" />
        </div>

        <!-- Tags/Badges -->
        <div class="flex gap-2">
          <Skeleton class="h-6 w-16 rounded-xl" />
          <Skeleton class="h-6 w-20 rounded-xl" />
        </div>
      </div>
    </div>

    <!-- Card footer - similar to header -->
    <div class="flex w-full items-center justify-between px-5 py-4">
      <Skeleton class="h-3 w-16" />
      <Skeleton class="h-3 w-24" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
</script>
