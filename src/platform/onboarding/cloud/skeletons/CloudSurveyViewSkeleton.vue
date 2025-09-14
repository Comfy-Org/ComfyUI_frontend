<template>
  <!-- Skeleton matching CloudSurveyView exact layout -->
  <div>
    <div class="flex flex-col min-h-[638px] min-w-[320px]">
      <!-- Progress bar skeleton - matching h-2 mb-8 exactly -->
      <Skeleton width="100%" height="0.5rem" class="h-2 mb-8" />

      <div class="p-0 flex-1 flex flex-col">
        <div class="flex-1 min-h-full flex flex-col justify-between">
          <div>
            <!-- Question label skeleton - matching text-lg font-medium block mb-8 -->
            <Skeleton width="60%" height="1.75rem" class="block mb-8" />

            <!-- Options list skeleton - matching exact structure -->
            <div class="flex flex-col gap-6">
              <div v-for="n in 5" :key="n" class="flex items-center gap-3">
                <!-- Radio button skeleton - matching actual RadioButton size -->
                <Skeleton shape="circle" width="1.25rem" height="1.25rem" />
                <!-- Option text skeleton - matching text-sm size -->
                <Skeleton :width="`${55 + n * 7}%`" height="1.25rem" />
              </div>
            </div>
          </div>

          <!-- Navigation buttons skeleton - matching first step (only next button) -->
          <div class="flex justify-between pt-4">
            <span />
            <Skeleton
              width="100%"
              height="2.5rem"
              border-radius="0.375rem"
              class="w-full h-10"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
</script>
