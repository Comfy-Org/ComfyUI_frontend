<template>
  <div class="mb-2 flex w-full flex-col">
    <!-- Pack header row: pack name + info + chevron -->
    <div class="flex h-8 w-full items-center">
      <!-- Warning icon for unknown packs -->
      <i
        v-if="group.packId === null && !group.isResolving"
        class="mr-1.5 icon-[lucide--triangle-alert] size-4 shrink-0 text-warning-background"
      />
      <p
        class="min-w-0 flex-1 truncate text-sm font-medium"
        :class="
          group.packId === null && !group.isResolving
            ? 'text-warning-background'
            : 'text-foreground'
        "
      >
        <span v-if="group.isResolving" class="text-muted-foreground italic">
          {{ t('g.loading') }}...
        </span>
        <span v-else>
          {{
            `${group.packId ?? t('rightSidePanel.missingNodePacks.unknownPack')} (${group.nodeTypes.length})`
          }}
        </span>
      </p>
      <Button
        v-if="showInfoButton && group.packId !== null"
        variant="textonly"
        size="icon-sm"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
        :aria-label="t('rightSidePanel.missingNodePacks.viewInManager')"
        @click="emit('openManagerInfo', group.packId ?? '')"
      >
        <i class="icon-[lucide--info] size-4" />
      </Button>
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
            ? t('rightSidePanel.missingNodePacks.collapse')
            : t('rightSidePanel.missingNodePacks.expand')
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
        class="mb-1 flex flex-col gap-0.5 overflow-hidden pl-2"
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
            :aria-label="t('rightSidePanel.locateNode')"
            @click="handleLocateNode(nodeType)"
          >
            <i class="icon-[lucide--locate] size-3" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Install button: shown when manager enabled, registry knows the pack or it's already installed -->
    <div
      v-if="
        shouldShowManagerButtons &&
        group.packId !== null &&
        (nodePack || comfyManagerStore.isPackInstalled(group.packId))
      "
      class="flex w-full items-start py-1"
    >
      <Button
        variant="secondary"
        size="md"
        class="flex w-full flex-1"
        :disabled="
          comfyManagerStore.isPackInstalled(group.packId) || isInstalling
        "
        @click="handlePackInstallClick"
      >
        <DotSpinner
          v-if="isInstalling"
          duration="1s"
          :size="12"
          class="mr-1.5 shrink-0"
        />
        <i
          v-else-if="comfyManagerStore.isPackInstalled(group.packId)"
          class="text-foreground mr-1 icon-[lucide--check] size-4 shrink-0"
        />
        <i
          v-else
          class="text-foreground mr-1 icon-[lucide--download] size-4 shrink-0"
        />
        <span class="text-foreground min-w-0 truncate text-sm">
          {{
            isInstalling
              ? t('rightSidePanel.missingNodePacks.installing')
              : comfyManagerStore.isPackInstalled(group.packId)
                ? t('rightSidePanel.missingNodePacks.installed')
                : t('rightSidePanel.missingNodePacks.installNodePack')
          }}
        </span>
      </Button>
    </div>

    <!-- Registry still loading: packId known but result not yet available -->
    <div
      v-else-if="group.packId !== null && shouldShowManagerButtons && isLoading"
      class="flex w-full items-start py-1"
    >
      <div
        class="flex h-8 min-w-0 flex-1 cursor-not-allowed items-center justify-center overflow-hidden rounded-lg bg-secondary-background p-2 opacity-60 select-none"
      >
        <DotSpinner duration="1s" :size="12" class="mr-1.5 shrink-0" />
        <span class="text-foreground min-w-0 truncate text-sm">
          {{ t('g.loading') }}
        </span>
      </div>
    </div>

    <!-- Search in Manager: fetch done but pack not found in registry -->
    <div
      v-else-if="group.packId !== null && shouldShowManagerButtons"
      class="flex w-full items-start py-1"
    >
      <Button
        variant="secondary"
        size="md"
        class="flex w-full flex-1"
        @click="
          openManager({
            initialTab: ManagerTab.All,
            initialPackId: group.packId!
          })
        "
      >
        <i class="text-foreground mr-1 icon-[lucide--search] size-4 shrink-0" />
        <span class="text-foreground min-w-0 truncate text-sm">
          {{ t('rightSidePanel.missingNodePacks.searchInManager') }}
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { cn } from '@/utils/tailwindUtil'
import { useI18n } from 'vue-i18n'
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

const props = defineProps<{
  group: MissingPackGroup
  showInfoButton: boolean
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  openManagerInfo: [packId: string]
}>()

const { t } = useI18n()

const { missingNodePacks, isLoading } = useMissingNodes()
const comfyManagerStore = useComfyManagerStore()
const { shouldShowManagerButtons, openManager } = useManagerState()

const nodePack = computed(() => {
  if (!props.group.packId) return null
  return missingNodePacks.value.find((p) => p.id === props.group.packId) ?? null
})

const { isInstalling, installAllPacks } = usePackInstall(() =>
  nodePack.value ? [nodePack.value] : []
)

function handlePackInstallClick() {
  if (!props.group.packId) return
  if (!comfyManagerStore.isPackInstalled(props.group.packId)) {
    void installAllPacks()
  }
}

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
    emit('locateNode', String(nodeType.nodeId))
  }
}
</script>
