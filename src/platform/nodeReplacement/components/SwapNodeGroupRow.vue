<template>
  <div class="mb-1 flex w-full flex-col gap-0.5 last:mb-0">
    <div
      :aria-current="highlighted ? 'true' : undefined"
      :class="
        cn(
          'flex min-h-8 items-center gap-1',
          selectionEmphasisClass(highlighted)
        )
      "
    >
      <Button
        v-if="hasMultipleNodeTypes"
        data-testid="swap-node-group-expand"
        variant="textonly"
        size="unset"
        :aria-label="
          expanded
            ? t('rightSidePanel.missingNodePacks.collapse', 'Collapse')
            : t('rightSidePanel.missingNodePacks.expand', 'Expand')
        "
        :aria-expanded="expanded"
        class="h-8 w-4 shrink-0 p-0 hover:bg-transparent focus-visible:ring-inset"
        @click="toggleExpand"
      >
        <i
          aria-hidden="true"
          :class="
            cn(
              'icon-[lucide--chevron-right] size-4 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-90'
            )
          "
        />
      </Button>

      <span class="flex min-w-0 flex-1 flex-col gap-0">
        <span class="flex min-w-0 items-center gap-2">
          <span class="flex min-w-0 items-center gap-2.5">
            <button
              v-if="hasMultipleNodeTypes"
              type="button"
              class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word text-base-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
              :title="group.type"
              :aria-label="titleToggleAriaLabel"
              :aria-expanded="expanded"
              @click="toggleExpand"
            >
              {{ group.type }}
            </button>
            <button
              v-else-if="primaryLocatableNodeType"
              type="button"
              class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word text-base-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
              :title="group.type"
              @click="handleLocateNode(primaryLocatableNodeType)"
            >
              {{ group.type }}
            </button>
            <span
              v-else
              class="min-w-0 truncate text-xs/relaxed font-normal text-base-foreground"
              :title="group.type"
            >
              {{ group.type }}
            </span>
            <span
              v-if="hasMultipleNodeTypes"
              data-testid="swap-node-group-count"
              role="img"
              class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-secondary-background-hover px-1 text-2xs font-semibold text-base-foreground"
              :aria-label="t('g.nodesCount', group.nodeTypes.length)"
            >
              {{ group.nodeTypes.length }}
            </span>
          </span>
        </span>
        <span class="min-w-0 text-xs/relaxed text-muted-foreground">
          {{
            t(
              'nodeReplacement.willBeReplacedBy',
              'This node will be replaced by:'
            )
          }}
          <span
            class="inline-flex rounded-sm bg-modal-card-tag-background px-1.5 py-0.5 text-xs/none font-medium text-modal-card-tag-foreground"
          >
            {{ replacementLabel }}
          </span>
        </span>
      </span>

      <Button
        variant="secondary"
        size="sm"
        class="shrink-0 focus-visible:ring-inset"
        @click="handleReplaceNode"
      >
        <i
          aria-hidden="true"
          class="text-foreground mr-1 icon-[lucide--repeat] size-4 shrink-0"
        />
        <span class="text-foreground min-w-0 truncate">
          {{ t('nodeReplacement.replaceNode', 'Replace Node') }}
        </span>
      </Button>

      <Button
        v-if="primaryLocatableNodeType"
        variant="textonly"
        size="icon-sm"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
        :aria-label="locateNodeLabel"
        @click="handleLocateNode(primaryLocatableNodeType)"
      >
        <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
      </Button>
    </div>

    <TransitionCollapse>
      <ul v-if="expanded" class="m-0 list-none space-y-1 p-0 pl-5">
        <li
          v-for="(nodeType, index) in group.nodeTypes"
          :key="getKey(nodeType, index)"
          class="min-w-0"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class="flex min-w-0 flex-1 items-center gap-1">
              <button
                v-if="isLocatableNodeType(nodeType)"
                type="button"
                class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
                @click="handleLocateNode(nodeType)"
              >
                {{ getLabel(nodeType) }}
              </button>
              <span
                v-else
                class="text-xs/relaxed wrap-break-word text-muted-foreground"
              >
                {{ getLabel(nodeType) }}
              </span>
            </span>
            <Button
              v-if="isLocatableNodeType(nodeType)"
              variant="textonly"
              size="icon-sm"
              class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
              :aria-label="locateNodeLabel"
              @click="handleLocateNode(nodeType)"
            >
              <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
            </Button>
          </div>
        </li>
      </ul>
    </TransitionCollapse>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import { selectionEmphasisClass } from '@/components/rightSidePanel/errors/selectionEmphasis'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import type { MissingNodeType } from '@/types/comfy'
import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

const { group, highlighted } = defineProps<{
  group: SwapNodeGroup
  /** Emphasize the header row (group containing the canvas selection). */
  highlighted?: boolean
}>()

const emit = defineEmits<{
  'locate-node': [nodeId: string]
  replace: [group: SwapNodeGroup]
}>()

const { t } = useI18n()

const expanded = ref(false)
const hasMultipleNodeTypes = computed(() => group.nodeTypes.length > 1)
const replacementLabel = computed(
  () => group.newNodeId ?? t('nodeReplacement.unknownNode', 'Unknown')
)
const locateNodeLabel = computed(() =>
  t('rightSidePanel.locateNode', 'Locate node on canvas')
)
const titleToggleAriaLabel = computed(
  () =>
    `${
      expanded.value
        ? t('rightSidePanel.missingNodePacks.collapse', 'Collapse')
        : t('rightSidePanel.missingNodePacks.expand', 'Expand')
    } ${group.type}`
)
const primaryLocatableNodeType = computed(() => {
  if (group.nodeTypes.length !== 1) return null
  const [nodeType] = group.nodeTypes
  return isLocatableNodeType(nodeType) ? nodeType : null
})

function toggleExpand() {
  expanded.value = !expanded.value
}

function getKey(nodeType: MissingNodeType, index: number): string {
  if (typeof nodeType === 'string') return `${nodeType}-${index}`
  return nodeType.nodeId != null
    ? String(nodeType.nodeId)
    : `${nodeType.type}-${index}`
}

function getLabel(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

function isLocatableNodeType(
  nodeType: MissingNodeType
): nodeType is Exclude<MissingNodeType, string> & { nodeId: string | number } {
  return typeof nodeType !== 'string' && nodeType.nodeId != null
}

function handleLocateNode(nodeType: MissingNodeType) {
  if (!isLocatableNodeType(nodeType)) return
  emit('locate-node', String(nodeType.nodeId))
}

function handleReplaceNode() {
  emit('replace', group)
}
</script>
