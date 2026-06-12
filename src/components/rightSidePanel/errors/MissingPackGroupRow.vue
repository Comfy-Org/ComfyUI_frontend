<template>
  <div class="mb-1 flex w-full flex-col gap-0.5 last:mb-0">
    <div class="flex min-h-8 w-full items-center gap-1">
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
        :class="
          cn(
            'h-8 w-4 shrink-0 p-0 transition-transform duration-200 hover:bg-transparent',
            expanded && 'rotate-90'
          )
        "
        @click="toggleExpand"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--chevron-right] size-4 text-muted-foreground"
        />
      </Button>
      <i
        v-if="isUnknownPack"
        class="icon-[lucide--triangle-alert] size-4 shrink-0 text-warning-background"
      />
      <span class="flex min-w-0 flex-1 items-center gap-2">
        <span class="flex min-w-0 items-center gap-2.5">
          <button
            v-if="hasMultipleNodeTypes && !group.isResolving"
            type="button"
            :class="
              cn(
                packTextButtonClass,
                isUnknownPack
                  ? 'text-warning-background'
                  : 'text-base-foreground'
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
                isUnknownPack
                  ? 'text-warning-background'
                  : 'text-base-foreground'
              )
            "
            @click="handleLocateNode(primaryLocatableNodeType)"
          >
            {{ packDisplayName }}
          </button>
          <span
            v-else
            class="min-w-0 truncate text-xs/relaxed font-normal"
            :class="
              isUnknownPack ? 'text-warning-background' : 'text-base-foreground'
            "
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
            variant="textonly"
            size="icon-sm"
            class="size-6 shrink-0 text-muted-foreground hover:bg-transparent hover:text-base-foreground"
            :aria-label="t('rightSidePanel.missingNodePacks.viewInManager')"
            @click="emit('openManagerInfo', group.packId ?? '')"
          >
            <i class="icon-[lucide--info] size-4" />
          </Button>
          <span
            v-if="showNodeCount"
            data-testid="missing-node-pack-count"
            class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-secondary-background-hover px-1 text-2xs font-semibold text-base-foreground"
          >
            {{ group.nodeTypes.length }}
          </span>
        </span>
      </span>
      <div v-if="showInstallAction" class="ml-auto shrink-0">
        <Button
          variant="secondary"
          size="sm"
          class="shrink-0"
          :disabled="isPackInstalled || isInstalling"
          @click="handlePackInstallClick"
        >
          <DotSpinner
            v-if="isInstalling"
            duration="1s"
            :size="12"
            class="mr-1.5 shrink-0"
          />
          <span class="text-foreground min-w-0 truncate">
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
        class="ml-auto flex h-6 shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-sm bg-secondary-background px-2 py-1 text-xs opacity-60 select-none"
      >
        <DotSpinner duration="1s" :size="12" class="mr-1.5 shrink-0" />
        <span class="text-foreground min-w-0 truncate text-xs">
          {{ t('g.loading') }}
        </span>
      </div>
      <div v-else-if="showSearchAction" class="ml-auto shrink-0">
        <Button
          variant="secondary"
          size="sm"
          class="shrink-0"
          @click="
            openManager({
              initialTab: ManagerTab.All,
              initialPackId: group.packId!
            })
          "
        >
          <span class="text-foreground min-w-0 truncate">
            {{ t('g.search') }}
          </span>
        </Button>
      </div>
      <Button
        v-if="primaryLocatableNodeType"
        variant="textonly"
        size="icon-sm"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
        :aria-label="t('rightSidePanel.locateNode')"
        @click="handleLocateNode(primaryLocatableNodeType)"
      >
        <i aria-hidden="true" class="icon-[lucide--locate] size-4" />
      </Button>
    </div>

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
                    'text-muted-foreground hover:text-base-foreground'
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
            <Button
              v-if="isLocatableNodeType(nodeType)"
              variant="textonly"
              size="icon-sm"
              class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
              :aria-label="t('rightSidePanel.locateNode')"
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
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import type { MissingNodeType } from '@/types/comfy'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'

const { group, showInfoButton } = defineProps<{
  group: MissingPackGroup
  showInfoButton: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  openManagerInfo: [packId: string]
}>()

const { t } = useI18n()
const expandedOverride = ref<boolean | null>(null)

const packTextButtonClass =
  'm-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word outline-none focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none'

const { missingNodePacks, isLoading } = useMissingNodes()
const comfyManagerStore = useComfyManagerStore()
const { shouldShowManagerButtons, openManager } = useManagerState()

const nodePack = computed(() => {
  if (!group.packId) return null
  return missingNodePacks.value.find((p) => p.id === group.packId) ?? null
})

const { isInstalling, installAllPacks } = usePackInstall(() =>
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
  () => group.packId !== null && comfyManagerStore.isPackInstalled(group.packId)
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
