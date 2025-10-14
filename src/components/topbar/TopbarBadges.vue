<template>
  <div
    v-for="badge in topbarBadgeStore.badges"
    :key="badge.text"
    class="flex flex-col justify-center bg-comfy-menu-secondary"
  >
    <div class="flex gap-2 px-3">
      <div v-if="badge.label" class="justify-center flex-col flex">
        <div
          class="rounded-4xl text-black bg-white gap-2.5 px-1 py-0.5 text-[9px] font-semibold"
        >
          {{ badge.label }}
        </div>
      </div>

      <div
        class="rounded-8 font-abcrom font-extrabold text-slate-100 text-[14px]"
      >
        {{ badge.text }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'

const topbarBadgeStore = useTopbarBadgeStore()
</script>
<style>
@import '../../platform/onboarding/cloud/assets/css/fonts.css';
</style>
