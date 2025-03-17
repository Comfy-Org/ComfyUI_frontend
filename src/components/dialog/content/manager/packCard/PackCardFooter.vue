<template>
  <div
    class="flex justify-between px-5 py-4 text-xs text-muted font-medium leading-3"
  >
    <div class="flex items-center gap-2 cursor-pointer">
      <span v-if="publisherName" class="max-w-40 truncate">
        {{ publisherName }}
      </span>
    </div>
    <div
      v-if="nodePack.latest_version?.createdAt"
      class="flex items-center gap-2 truncate"
    >
      {{ $t('g.updated') }}
      {{
        $d(new Date(nodePack.latest_version.createdAt), {
          dateStyle: 'medium'
        })
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const publisherName = computed(() => {
  if (!nodePack) return null

  const { publisher, author } = nodePack
  return publisher?.name ?? publisher?.id ?? author
})
</script>
