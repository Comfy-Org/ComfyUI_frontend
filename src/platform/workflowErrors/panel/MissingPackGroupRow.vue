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
        data-testid="missing-node-pack-expand"
        variant="textonly"
        size="unset"
        :aria-label="
          expanded
            ? t('rightSidePanel.missingNodePacks.collapse')
            : t('rightSidePanel.missingNodePacks.expand')
        "
        :aria-expanded="expanded"
        class="h-8 w-4 shrink-0 p-0 hover:bg-transparent focus-visible:ring-inset"
        @click="toggleExpand"
      >
        <i
          aria-hidden="true"
          :class="
            cn(
              'icon-[lucide--chevron-right] text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-90'
            )
          "
        />
      </Button>
      <i
        v-if="isUnknownPack"
        class="icon-[comfy--triangle-alert-filled] text-warning"
      />
      <span class="flex min-w-0 flex-1 items-center gap-2">
        <span class="flex min-w-0 items-center gap-2.5">
          <button
            v-if="hasMultipleNodeTypes && !group.isResolving"
            type="button"
            :class="
              cn(
                packTextButtonClass,
                isUnknownPack ? 'text-warning' : 'text-foreground'
              )
            "
            :aria-expanded="expanded"
            @click="toggleExpand"
          >
            {{ packDisplayName }}
          </button>
          <button
            v-else-if="primaryLocatableNodeType"
            type="button"
            :class="
              cn(
                packTextButtonClass,
                isUnknownPack ? 'text-warning' : 'text-foreground'
              )
            "
            @click="handleLocateNode(primaryLocatableNodeType)"
          >
            {{ packDisplayName }}
          </button>
          <span
            v-else
            class="min-w-0 truncate text-xs/relaxed font-normal"
            :class="isUnknownPack ? 'text-warning' : 'text-foreground'"
          >
            <span v-if="group.isResolving" class="text-muted-foreground italic">
              {{ t('g.loading') }}...
            </span>
            <span v-else>
              {{ packDisplayName }}
            </span>
          </span>
          <Button
            v-if="showInfoButton && group.packId !== null"
            variant="muted-textonly"
            size="icon-sm"
            class="size-6 shrink-0 hover:bg-transparent hover:text-foreground focus-visible:ring-inset"
            :aria-label="t('rightSidePanel.missingNodePacks.viewInManager')"
            @click="emit('openManagerInfo', group.packId ?? '')"
          >
            <i class="icon-[lucide--info]" />
          </Button>
          <span
            v-if="showNodeCount"
            data-testid="missing-node-pack-count"
            class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-accent px-1 text-2xs font-semibold"
          >
            {{ group.nodeTypes.length }}
          </span>
        </span>
      </span>
      <div v-if="showInstallAction" class="ml-auto shrink-0">
        <Button
          variant="secondary"
          size="sm"
          class="shrink-0 focus-visible:ring-inset"
          :disabled="isPackInstalled || isInstalling"
          @click="handlePackInstallClick"
        >
          <DotSpinner
            v-if="isInstalling"
            duration="1s"
            :size="12"
            class="mr-1.5 shrink-0"
          />
          <span class="min-w-0 truncate text-foreground">
            {{
              isInstalling
                ? t('rightSidePanel.missingNodePacks.installing')
                : isPackInstalled
                  ? t('rightSidePanel.missingNodePacks.installed')
                  : t('g.install')
            }}
          </span>
        </Button>
      </div>
      <div
        v-else-if="showLoadingAction"
        class="ml-auto flex h-6 shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-sm bg-secondary px-2 py-1 text-xs opacity-60 select-none"
      >
        <DotSpinner duration="1s" :size="12" class="mr-1.5 shrink-0" />
        <span class="min-w-0 truncate">
          {{ t('g.loading') }}
        </span>
      </div>
      <div v-else-if="showSearchAction" class="ml-auto shrink-0">
        <Button
          variant="secondary"
          size="sm"
          class="shrink-0 focus-visible:ring-inset"
          @click="
            openManager({
              initialTab: 'all',
              initialPackId: group.packId!
            })
          "
        >
          <span class="min-w-0 truncate text-foreground">
            {{ t('g.search') }}
          </span>
        </Button>
      </div>
      <LocateNodeButton
        v-if="primaryLocatableNodeType"
        :label="
          t(
            'rightSidePanel.locateNodeFor',
            {
              item: getLabel(primaryLocatableNodeType)
            },
            { escapeParameter: false }
          )
        "
        @locate="handleLocateNode(primaryLocatableNodeType)"
      />
    </div>

    <p
      v-if="unsupportedPack"
      :class="
        cn(
          'm-0 text-xs/relaxed wrap-break-word text-muted-foreground',
          hasMultipleNodeTypes && 'pl-5'
        )
      "
    >
      {{
        unsupportedPack.cause
          ? t(
              'rightSidePanel.missingNodePacks.unsupportedOnBuild',
              { cause: unsupportedPack.cause },
              { escapeParameter: false }
            )
          : t('rightSidePanel.missingNodePacks.unsupportedOnBuildNoCause')
      }}
    </p>

    <TransitionCollapse>
      <ul
        v-if="showNodeTypeList"
        :class="
          cn(
            'm-0 list-none p-0',
            (hasMultipleNodeTypes || isUnknownPack) && 'pl-5'
          )
        "
      >
        <li
          v-for="nodeType in group.nodeTypes"
          :key="getKey(nodeType)"
          class="min-w-0"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class="flex min-w-0 flex-1 items-center gap-1">
              <button
                v-if="isLocatableNodeType(nodeType)"
                type="button"
                :class="
                  cn(
                    packTextButtonClass,
                    'text-muted-foreground hover:text-foreground'
                  )
                "
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
            <LocateNodeButton
              v-if="isLocatableNodeType(nodeType)"
              :label="
                t(
                  'rightSidePanel.locateNodeFor',
                  { item: getLabel(nodeType) },
                  { escapeParameter: false }
                )
              "
              @locate="handleLocateNode(nodeType)"
            />
          </div>
        </li>
      </ul>
    </TransitionCollapse>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import { selectionEmphasisClass } from './selectionEmphasis'
import Button from '@comfyorg/design-system/button/Button'
import DotSpinner from '@comfyorg/design-system/common/DotSpinner'
import LocateNodeButton from '@/platform/workflowErrors/panel/LocateNodeButton.vue'
import TransitionCollapse from '@comfyorg/design-system/transition/TransitionCollapse'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useWorkflowErrorManager } from '@/platform/workflowErrors/workflowErrorManager'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import type { MissingPackGroup } from '@/platform/workflowErrors/panel/useErrorGroups'

const { group, showInfoButton, highlighted } = defineProps<{
  group: MissingPackGroup
  showInfoButton: boolean
  /** Emphasize the header row (pack containing the canvas selection). */
  highlighted?: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  openManagerInfo: [packId: string]
}>()

const { t } = useI18n()
const expandedOverride = ref<boolean | null>(null)

const packTextButtonClass =
  'm-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word outline-none focus:outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none'

const manager = useWorkflowErrorManager()
const { missingNodePacks, isLoading } = manager.useMissingNodes()
const { shouldShowManagerButtons } = manager.useManagerState()
const { openManager } = manager
const deploymentPick = useDeploymentPickStore()

const nodePack = computed(() => {
  if (!group.packId) return null
  return missingNodePacks.value.find((p) => p.id === group.packId) ?? null
})

const { isInstalling, installAllPacks } = manager.usePackInstall(() =>
  nodePack.value ? [nodePack.value] : []
)

const isUnknownPack = computed(
  () => group.packId === null && !group.isResolving
)

const packDisplayName = computed(() => {
  if (group.packId === null) {
    return t('rightSidePanel.missingNodePacks.unknownPack')
  }
  return nodePack.value?.name ?? group.packId
})

const isPackInstalled = computed(
  () => group.packId !== null && manager.isPackInstalled(group.packId)
)

const showInstallAction = computed(
  () =>
    shouldShowManagerButtons.value &&
    group.packId !== null &&
    (nodePack.value !== null || isPackInstalled.value)
)

const showLoadingAction = computed(
  () =>
    shouldShowManagerButtons.value &&
    group.packId !== null &&
    !showInstallAction.value &&
    isLoading.value
)

const showSearchAction = computed(
  () =>
    shouldShowManagerButtons.value &&
    group.packId !== null &&
    !showInstallAction.value &&
    !showLoadingAction.value
)

const unsupportedPack = computed(() => {
  for (const nodeType of group.nodeTypes) {
    if (typeof nodeType === 'string' || !nodeType.cnrId) continue
    const pack = deploymentPick.unsupportedPackFor(nodeType.cnrId)
    if (pack) return pack
  }
  return undefined
})

const hasMultipleNodeTypes = computed(() => group.nodeTypes.length > 1)
const showNodeCount = computed(() => group.nodeTypes.length !== 1)
const expanded = computed(
  () =>
    expandedOverride.value ??
    (isUnknownPack.value && hasMultipleNodeTypes.value)
)
const showNodeTypeList = computed(
  () =>
    (isUnknownPack.value && group.nodeTypes.length === 1) ||
    (hasMultipleNodeTypes.value && expanded.value)
)
const primaryLocatableNodeType = computed(() => {
  if (group.isResolving) return null
  if (isUnknownPack.value) return null
  if (group.nodeTypes.length !== 1) return null
  const [nodeType] = group.nodeTypes
  return isLocatableNodeType(nodeType) ? nodeType : null
})

function handlePackInstallClick() {
  if (!group.packId) return
  if (!isPackInstalled.value) {
    void installAllPacks()
  }
}

function toggleExpand() {
  expandedOverride.value = !expanded.value
}

function getKey(nodeType: MissingNodeType): string {
  if (typeof nodeType === 'string') return nodeType
  return nodeType.nodeId != null ? String(nodeType.nodeId) : nodeType.type
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
  emit('locateNode', String(nodeType.nodeId))
}
</script>
