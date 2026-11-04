<script setup lang="ts">
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { SuperCanvasKey } from '@/renderer/extensions/superComfy/canvas/canvasContext'
import type {
  IoNode,
  SuperNode
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  findNode,
  portsOf,
  upstreamIds
} from '@/renderer/extensions/superComfy/engine/graphTopology'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'
import {
  modalityIcon,
  modalityLabelKey
} from '@/renderer/extensions/superComfy/superComfyModality'

import BatchBar from './BatchBar.vue'
import IoFileDrop from './IoFileDrop.vue'
import MediaBatchPreview from './MediaBatchPreview.vue'
import NodeMenu from './NodeMenu.vue'
import NodeShell from './NodeShell.vue'
import TextItemList from './TextItemList.vue'
import { itemEntries } from './nodeView'
import { useBatchIndex } from './useBatchIndex'

const { node, selected } = defineProps<{
  node: IoNode
  selected: boolean
}>()

const NO_MISSING: readonly string[] = []

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const canvas = inject(SuperCanvasKey, null)

const ports = computed(() => portsOf(node))
const entries = computed(() => itemEntries(node.items))
const index = useBatchIndex(() => entries.value.length)
const fileModality = computed(() =>
  node.modality === 'text' ? null : node.modality
)
const uploading = computed(() => store.isUploading(node.id))

function sourceTitle(source: SuperNode): string {
  switch (source.kind) {
    case 'io':
      return t(modalityLabelKey(source.modality))
    case 'generate':
      return (
        source.modelLabel ??
        t('superComfy.menu.generateNode', {
          modality: t(modalityLabelKey(source.modality))
        })
      )
    case 'app':
      return source.title
  }
}

const fromNode = computed(() => {
  const doc = store.state.doc
  const sources = upstreamIds(doc, node.id).flatMap((id) => {
    const source = findNode(doc, id)
    return source ? [sourceTitle(source)] : []
  })
  return sources.length > 0
    ? t('superComfy.node.fromNode', { node: sources.join(', ') })
    : ''
})

const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('superComfy.node.clearItems'),
    icon: 'icon-[lucide--eraser]',
    disabled: node.items.length === 0,
    command: () =>
      store.dispatch({
        type: 'itemsAdded',
        nodeId: node.id,
        items: [],
        mode: 'replace'
      })
  },
  {
    label: t('superComfy.node.delete'),
    icon: 'icon-[lucide--trash-2]',
    command: () => store.removeNodes([node.id])
  }
])
</script>

<template>
  <NodeShell
    :node-id="node.id"
    :inputs="ports.inputs"
    :outputs="ports.outputs"
    :selected
    :running="false"
    :missing="NO_MISSING"
    :show-labels="selected || (canvas?.draftActive.value ?? false)"
  >
    <template #header>
      <i :class="cn('size-3.5', modalityIcon(node.modality))" />
      <span class="shrink-0 font-medium text-foreground">
        {{ t(modalityLabelKey(node.modality)) }}
      </span>
      <span class="min-w-0 flex-1 truncate text-muted-foreground">
        {{ fromNode }}
      </span>
      <div
        :class="
          cn(
            'shrink-0 transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-100'
          )
        "
      >
        <NodeMenu :items="menuItems" />
      </div>
    </template>
    <template #preview>
      <TextItemList v-if="fileModality === null" :node />
      <IoFileDrop
        v-else
        :node-id="node.id"
        :modality="fileModality"
        :empty="entries.length === 0"
      >
        <MediaBatchPreview
          v-if="entries.length > 0"
          v-model:index="index"
          :entries
          :selected
        />
      </IoFileDrop>
      <div
        v-if="uploading"
        class="absolute inset-0 flex items-center justify-center bg-node/70"
      >
        <i
          class="icon-[lucide--loader-circle] size-5 animate-spin text-muted-foreground"
        />
      </div>
    </template>
    <template #gap>
      <BatchBar
        v-model="index"
        :count="entries.length"
        :navigable="fileModality !== null"
      />
    </template>
  </NodeShell>
</template>
