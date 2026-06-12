<template>
  <template v-for="child in node.children" :key="child.id">
    <button
      type="button"
      class="group/tree-node flex w-full min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-sm border-0 bg-transparent py-1.5 text-left outline-none select-none hover:bg-comfy-input"
      :style="{ paddingLeft: `${8 + (depth + 1) * 16}px` }"
      :aria-expanded="Boolean(expanded[child.id])"
      @click="$emit('toggle', child.id)"
    >
      <i
        :class="
          cn(
            'icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground transition-transform',
            !expanded[child.id] && '-rotate-90'
          )
        "
      />
      <i class="icon-[lucide--folder] size-4 shrink-0 text-muted-foreground" />
      <span class="text-foreground min-w-0 flex-1 truncate text-sm">
        {{ child.name }}
      </span>
      <span class="shrink-0 pr-2 text-2xs text-muted-foreground">
        {{ child.totalCount }}
      </span>
    </button>
    <ModelFolderTree
      v-if="expanded[child.id]"
      :node="child"
      :depth="depth + 1"
      :expanded
      @toggle="$emit('toggle', $event)"
      @asset-activate="$emit('assetActivate', $event)"
      @asset-hover-change="$emit('assetHoverChange', $event)"
      @partner-activate="$emit('partnerActivate', $event)"
      @partner-hover-change="$emit('partnerHoverChange', $event)"
    />
  </template>
  <template v-for="pg in node.providers" :key="pg.provider">
    <div
      v-if="node.providers.length > 1"
      class="pt-2 pr-2 pb-0.5 text-3xs font-medium tracking-wide text-muted-foreground uppercase"
      :style="{ paddingLeft: `${32 + depth * 16}px` }"
    >
      {{ pg.provider }}
    </div>
    <div
      v-for="item in pg.items"
      :key="itemKey(item)"
      :style="{ paddingLeft: `${depth * 16}px` }"
    >
      <CloudModelLeaf
        v-if="item.kind === 'asset'"
        :asset="item.asset"
        @activate="$emit('assetActivate', $event)"
        @hover-change="$emit('assetHoverChange', $event)"
      />
      <CloudPartnerLeaf
        v-else
        :node-def="item.nodeDef"
        @activate="$emit('partnerActivate', $event)"
        @hover-change="$emit('partnerHoverChange', $event)"
      />
    </div>
  </template>
</template>

<script setup lang="ts">
import CloudModelLeaf from '@/components/sidebar/tabs/cloudModelLibrary/CloudModelLeaf.vue'
import CloudPartnerLeaf from '@/components/sidebar/tabs/cloudModelLibrary/CloudPartnerLeaf.vue'
import type { FolderNode } from '@/components/sidebar/tabs/cloudModelLibrary/modelFolderTree'
import type { SidebarItem } from '@/components/sidebar/tabs/cloudModelLibrary/modelLibrarySort'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { cn } from '@comfyorg/tailwind-utils'

const { node, depth, expanded } = defineProps<{
  node: FolderNode
  depth: number
  expanded: Record<string, boolean>
}>()

defineEmits<{
  toggle: [id: string]
  assetActivate: [asset: AssetItem]
  assetHoverChange: [
    payload: { asset: AssetItem; rect: DOMRect } | { asset: null }
  ]
  partnerActivate: [nodeDef: ComfyNodeDefImpl]
  partnerHoverChange: [
    payload: { nodeDef: ComfyNodeDefImpl; rect: DOMRect } | { nodeDef: null }
  ]
}>()

function itemKey(item: SidebarItem): string {
  return item.kind === 'asset' ? `a:${item.asset.id}` : `n:${item.nodeDef.name}`
}
</script>
