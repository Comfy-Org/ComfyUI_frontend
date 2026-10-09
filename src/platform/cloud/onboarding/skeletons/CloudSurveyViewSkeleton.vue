<template>
  <div>
    <div class="flex min-h-[638px] min-w-[320px] flex-col">
      <Skeleton class="mb-8 h-2 w-full" />

      <div class="flex flex-1 flex-col p-0">
        <div class="flex min-h-full flex-1 flex-col justify-between">
          <div>
            <Skeleton class="mb-8 h-7 w-7/10" />
            <div class="flex flex-col gap-6">
              <div v-for="i in 5" :key="i" class="flex items-center gap-3">
                <Skeleton class="size-5 rounded-full" />
                <Skeleton class="h-3.5 w-17/20" />
              </div>
            </div>
          </div>

          <div class="flex justify-between pt-4">
            <span />
            <Skeleton class="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
</script>
