<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="(conflict, index) in conflictResult?.conflicts || []"
      :key="index"
      class="p-3 bg-yellow-800/20 rounded-md"
    >
      <div class="text-sm">
        {{ getConflictMessage(conflict, $t) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { components } from '@/types/comfyRegistryTypes'
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'
import { getConflictMessage } from '@/utils/conflictMessageUtil'

const { conflictResult } = defineProps<{
  nodePack: components['schemas']['Node']
  conflictResult?: ConflictDetectionResult | null
}>()
</script>
