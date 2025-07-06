<template>
  <Message
    v-if="hasMissingCoreNodes"
    severity="info"
    icon="pi pi-info-circle"
    class="my-2 mx-2"
    :pt="{
      root: { class: 'flex-col' },
      text: { class: 'flex-1' }
    }"
  >
    <div class="flex flex-col gap-2">
      <div>
        {{
          currentComfyUIVersion
            ? $t('loadWorkflowWarning.outdatedVersion', {
                version: currentComfyUIVersion
              })
            : $t('loadWorkflowWarning.outdatedVersionGeneric')
        }}
      </div>
      <div
        v-for="[version, nodes] in sortedMissingCoreNodes"
        :key="version"
        class="ml-4"
      >
        <div
          class="text-sm font-medium text-surface-600 dark-theme:text-surface-400"
        >
          {{
            $t('loadWorkflowWarning.coreNodesFromVersion', {
              version: version || 'unknown'
            })
          }}
        </div>
        <div class="ml-4 text-sm text-surface-500 dark-theme:text-surface-500">
          {{ getUniqueNodeNames(nodes).join(', ') }}
        </div>
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { whenever } from '@vueuse/core'
import Message from 'primevue/message'
import { computed, ref } from 'vue'

import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { compareVersions } from '@/utils/formatUtil'

const props = defineProps<{
  missingCoreNodes: Record<string, LGraphNode[]>
}>()

const systemStatsStore = useSystemStatsStore()

const hasMissingCoreNodes = computed(() => {
  return Object.keys(props.missingCoreNodes).length > 0
})

const currentComfyUIVersion = ref<string | null>(null)
whenever(
  hasMissingCoreNodes,
  async () => {
    if (!systemStatsStore.systemStats) {
      await systemStatsStore.fetchSystemStats()
    }
    currentComfyUIVersion.value =
      systemStatsStore.systemStats?.system?.comfyui_version ?? null
  },
  {
    immediate: true
  }
)

const sortedMissingCoreNodes = computed(() => {
  return Object.entries(props.missingCoreNodes).sort(([a], [b]) => {
    // Sort by version in descending order (newest first)
    return compareVersions(b, a) // Reversed for descending order
  })
})

const getUniqueNodeNames = (nodes: LGraphNode[]): string[] => {
  return nodes
    .reduce<string[]>((acc, node) => {
      if (node.type && !acc.includes(node.type)) {
        acc.push(node.type)
      }
      return acc
    }, [])
    .sort()
}
</script>
