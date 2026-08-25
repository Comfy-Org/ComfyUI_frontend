<template>
  <div
    class="flex aspect-square size-8 items-center justify-center rounded-md text-base font-semibold text-white"
    :style="{ backgroundColor }"
  >
    {{ letter }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { workspaceAvatarColor } from '@/platform/workspace/components/workspaceAvatarColor'

const { workspaceName } = defineProps<{
  workspaceName: string
}>()

const letter = computed(
  () => Array.from(workspaceName ?? '')[0]?.toUpperCase() ?? '?'
)

const backgroundColor = computed(() => workspaceAvatarColor(workspaceName))
</script>
