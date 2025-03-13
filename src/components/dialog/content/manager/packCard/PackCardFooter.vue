<template>
  <div class="flex justify-between p-5 text-xs text-muted">
    <div class="flex items-center gap-2 cursor-pointer">
      <span v-if="nodePack.publisher?.name">
        {{ nodePack.publisher.name }}
      </span>
      <PackVersionBadge v-if="isInstalled" :node-pack="nodePack" />
      <span v-else-if="nodePack.latest_version">
        {{ nodePack.latest_version.version }}
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

import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const { isPackInstalled } = useComfyManagerStore()
const isInstalled = computed(() => isPackInstalled(nodePack?.id))
</script>
