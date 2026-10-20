<template>
  <Badge
    v-if="nodeDef.api_node && providerName"
    variant="outline"
    class="text-foreground"
    :style="borderStyle"
  >
    <template #icon>
      <i :class="cn(getProviderIcon(providerName), 'size-2.5')" />
    </template>
    {{ providerName }}
  </Badge>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/ui/badge/Badge.vue'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import {
  getProviderBorderStyle,
  getProviderIcon,
  getProviderName
} from '@/utils/categoryUtil'

const { nodeDef } = defineProps<{
  nodeDef: ComfyNodeDefImpl
}>()

const providerName = computed(() => getProviderName(nodeDef.category))

const borderStyle = computed(() => {
  const border = getProviderBorderStyle(providerName.value)
  if (!border.includes('linear-gradient')) return { borderColor: border }
  return {
    borderColor: 'transparent',
    backgroundImage: `linear-gradient(var(--background), var(--background)), ${border}`,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box'
  }
})
</script>
