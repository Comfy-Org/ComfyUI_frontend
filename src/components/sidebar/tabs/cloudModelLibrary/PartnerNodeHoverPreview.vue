<template>
  <div
    class="flex w-96 flex-col gap-2 rounded-xl border border-border-default bg-comfy-menu-bg p-3 text-xs text-base-foreground shadow-lg"
  >
    <div
      v-if="provider || kind"
      class="flex items-center gap-1.5 text-2xs tracking-wide text-muted-foreground uppercase"
    >
      <span v-if="provider">{{ provider }}</span>
      <span v-if="provider && kind" class="opacity-60">·</span>
      <span v-if="kind">{{ kind }}</span>
    </div>
    <div class="text-sm font-semibold">{{ nodeDef.display_name }}</div>
    <div v-if="nodeDef.description" class="text-muted-foreground">
      {{ nodeDef.description }}
    </div>
    <div
      class="-mx-3 mt-1 -mb-3 flex flex-col gap-1.5 border-t border-border-default bg-muted-background/40 p-3 pt-2"
    >
      <div class="text-2xs tracking-wide text-muted-foreground uppercase">
        {{ $t('cloudModelLibrary.preview.createsNode') }}
      </div>
      <div class="flex justify-center">
        <NodePreview :node-def="nodeDef" position="relative" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import NodePreview from '@/components/node/NodePreview.vue'
import { formatPartnerProvider } from '@/components/sidebar/tabs/cloudModelLibrary/modelGroups'
import { partnerKind } from '@/components/sidebar/tabs/cloudModelLibrary/modelLibraryGrouping'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { nodeDef } = defineProps<{ nodeDef: ComfyNodeDefImpl }>()

const provider = computed(() => formatPartnerProvider(nodeDef.category))
const kind = computed(() => partnerKind(nodeDef.category))
</script>
