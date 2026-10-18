<script setup lang="ts">
import { computed } from 'vue'
import BrandButton from '@/components/common/BrandButton.vue'
const { zh, reduced, paused } = defineProps<{
  zh: boolean
  reduced: boolean
  paused: boolean
}>()
const emit = defineEmits<{ toggle: []; replay: [] }>()
const statusLabel = computed(() => {
  if (reduced)
    return zh
      ? '已减少动态效果：展示最终输出'
      : 'Reduced motion: final outputs shown'
  return zh ? '录制示例 · 不执行命令' : 'Recorded example · no commands execute'
})
const playbackLabel = computed(() => {
  if (paused) return zh ? '继续' : 'Resume'
  return zh ? '暂停' : 'Pause'
})
</script>
<template>
  <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p class="text-xs text-smoke-700">
      {{ statusLabel }}
    </p>
    <div class="flex gap-2">
      <BrandButton
        v-if="!reduced"
        class="uppercase"
        variant="outline"
        :aria-pressed="paused"
        @click="emit('toggle')"
        >{{ playbackLabel }}</BrandButton
      >
      <BrandButton
        v-if="!reduced"
        class="uppercase"
        variant="outline"
        @click="emit('replay')"
        >{{ zh ? '重播' : 'Replay' }}</BrandButton
      >
    </div>
  </div>
</template>
