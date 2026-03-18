<template>
  <div class="mb-4 flex w-full flex-col">
    <!-- Type header row: type name + chevron -->
    <div class="flex h-8 w-full items-center">
      <p class="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
        {{ `${group.type} (${group.nodeTypes.length})` }}
      </p>

      <Button
        variant="textonly"
        size="icon-sm"
        :class="
          cn(
            'size-8 shrink-0 transition-transform duration-200 hover:bg-transparent',
            { 'rotate-180': expanded }
          )
        "
        :aria-label="
          expanded
            ? t('rightSidePanel.missingNodePacks.collapse', 'Collapse')
            : t('rightSidePanel.missingNodePacks.expand', 'Expand')
        "
        @click="toggleExpand"
      >
        <i
          class="icon-[lucide--chevron-down] size-4 text-muted-foreground group-hover:text-base-foreground"
        />
      </Button>
    </div>

    <!-- Sub-labels: individual node instances, each with their own Locate button -->
    <TransitionCollapse>
      <div
        v-if="expanded"
        class="mb-2 flex flex-col gap-0.5 overflow-hidden pl-2"
      >
        <div
          v-for="nodeType in group.nodeTypes"
          :key="getKey(nodeType)"
          class="flex h-7 items-center"
        >
          <span
            v-if="
              showNodeIdBadge &&
              typeof nodeType !== 'string' &&
              nodeType.nodeId != null
            "
            class="mr-1 shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
          >
            #{{ nodeType.nodeId }}
          </span>
          <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {{ getLabel(nodeType) }}
          </p>
          <Button
            v-if="typeof nodeType !== 'string' && nodeType.nodeId != null"
            variant="textonly"
            size="icon-sm"
            class="mr-1 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
            :aria-label="t('rightSidePanel.locateNode', 'Locate Node')"
            @click="handleLocateNode(nodeType)"
          >
            <i class="icon-[lucide--locate] size-3" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Description rows: what it is replaced by -->
    <div class="mt-1 mb-2 flex flex-col gap-0.5 px-1 text-[13px]">
      <span class="text-muted-foreground">{{
        t('nodeReplacement.willBeReplacedBy', 'This node will be replaced by:')
      }}</span>
      <span class="text-foreground font-bold">{{
        group.newNodeId ?? t('nodeReplacement.unknownNode', 'Unknown')
      }}</span>
    </div>

    <!-- Replace Action Button -->
    <div class="flex w-full items-start py-1">
      <Button
        variant="secondary"
        size="md"
        class="flex w-full flex-1"
        @click="handleReplaceNode"
      >
        <i class="text-foreground mr-1 icon-[lucide--repeat] size-4 shrink-0" />
        <span class="text-foreground min-w-0 truncate text-sm">
          {{ t('nodeReplacement.replaceNode', 'Replace Node') }}
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/utils/tailwindUtil'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import type { MissingNodeType } from '@/types/comfy'
import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

const props = defineProps<{
  group: SwapNodeGroup
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  'locate-node': [nodeId: string]
  replace: [group: SwapNodeGroup]
}>()

const { t } = useI18n()

const expanded = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}

function getKey(nodeType: MissingNodeType): string {
  if (typeof nodeType === 'string') return nodeType
  return nodeType.nodeId != null ? String(nodeType.nodeId) : nodeType.type
}

function getLabel(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

function handleLocateNode(nodeType: MissingNodeType) {
  if (typeof nodeType === 'string') return
  if (nodeType.nodeId != null) {
    emit('locate-node', String(nodeType.nodeId))
  }
}

function handleReplaceNode() {
  emit('replace', props.group)
}
</script>
