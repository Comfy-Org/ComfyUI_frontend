<script setup lang="ts">
import type { FramePose } from '../../../lib/workshop/sprite-sheet/poses'
import { poseTransform } from '../../../lib/workshop/sprite-sheet/poses'

const { url, pose } = defineProps<{ url: string; pose: FramePose }>()
</script>

<template>
  <span class="pointer-events-none absolute inset-0 block" aria-hidden="true">
    <span
      class="absolute top-[88%] left-1/2 h-[6%] w-1/2 -translate-1/2 rounded-[50%] bg-black/30"
      :style="{ scale: pose.shadow }"
    />
    <img
      :src="url"
      alt=""
      draggable="false"
      class="absolute inset-x-[7%] top-[28%] h-[62%] w-[86%] origin-bottom object-contain object-bottom"
      :style="{ transform: poseTransform(pose) }"
    />
  </span>
</template>
