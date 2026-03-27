<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import {
  vGroupDropTarget,
  vGroupItemDraggable,
  vGroupItemReorderTarget
} from '@/components/builder/useGroupDrop'
import {
  autoGroupName,
  groupedByPair,
  resolveGroupItems
} from '@/components/builder/useInputGroups'
import { OverlayAppendToKey } from '@/composables/useTransformCompatOverlayProps'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import WidgetItem from '@/components/rightSidePanel/parameters/WidgetItem.vue'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputGroup } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import type { WidgetValue } from '@/utils/widgetUtil'
import { cn } from '@/utils/tailwindUtil'

const {
  group,
  zoneId,
  builderMode = false,
  position = 'middle'
} = defineProps<{
  group: InputGroup
  zoneId: string
  builderMode?: boolean
  position?: 'first' | 'middle' | 'last' | 'only'
}>()

const { t } = useI18n()
const appModeStore = useAppModeStore()
const canvasStore = useCanvasStore()

provide(HideLayoutFieldKey, true)
provide(OverlayAppendToKey, 'body')

const isOpen = ref(builderMode)
const isRenaming = ref(false)
const showUngroupDialog = ref(false)
const renameValue = ref('')
let renameStartedAt = 0

const displayName = computed(() => group.name ?? autoGroupName(group))
const resolvedItems = computed(() => resolveGroupItems(group))
const rows = computed(() => groupedByPair(resolvedItems.value))

function startRename() {
  if (!builderMode) return
  renameValue.value = displayName.value
  renameStartedAt = Date.now()
  isRenaming.value = true
}

function confirmRename() {
  if (Date.now() - renameStartedAt < 150) return
  const trimmed = renameValue.value.trim()
  appModeStore.renameGroup(group.id, trimmed || null)
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}

function startRenameDeferred() {
  setTimeout(startRename, 50)
}

function handleDissolve() {
  appModeStore.dissolveGroup(group.id, zoneId)
}

function handleWidgetValueUpdate(widget: IBaseWidget, value: WidgetValue) {
  if (value === undefined) return
  widget.value = value
  widget.callback?.(value)
  canvasStore.canvas?.setDirty(true, true)
}
</script>

<template>
  <CollapsibleRoot
    v-model:open="isOpen"
    :class="
      cn(
        'flex flex-col',
        builderMode &&
          'rounded-lg border border-dashed border-primary-background/40',
        !builderMode && 'border-border-subtle/40',
        !builderMode &&
          position !== 'first' &&
          position !== 'only' &&
          'border-t',
        !builderMode &&
          (position === 'last' || position === 'only') &&
          'border-b'
      )
    "
  >
    <!-- Header row — draggable in builder mode -->
    <div
      :class="
        cn(
          'flex items-center gap-1',
          builderMode ? 'drag-handle cursor-grab py-1 pr-1.5 pl-1' : 'px-4 py-2'
        )
      "
    >
      <!-- Rename input (outside CollapsibleTrigger to avoid focus conflicts) -->
      <div v-if="isRenaming" class="flex flex-1 items-center gap-1.5 px-3 py-2">
        <input
          v-model="renameValue"
          type="text"
          class="min-w-0 flex-1 border-none bg-transparent text-sm text-base-foreground outline-none"
          @click.stop
          @keydown.enter.stop="confirmRename"
          @keydown.escape.stop="cancelRename"
          @blur="confirmRename"
          @vue:mounted="
            ($event: any) => {
              $event.el?.focus()
              $event.el?.select()
            }
          "
        />
      </div>
      <!-- Name + chevron -->
      <CollapsibleTrigger v-else as-child>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-1.5 border border-transparent bg-transparent px-3 py-2 text-left outline-none"
        >
          <Tooltip :text="displayName" side="left" :side-offset="20">
            <span
              class="flex-1 truncate text-sm font-bold text-base-foreground"
              @dblclick.stop="startRename"
            >
              {{ displayName }}
            </span>
          </Tooltip>
          <i
            :class="
              cn(
                'icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )
            "
          />
        </button>
      </CollapsibleTrigger>
      <!-- Builder actions on the right -->
      <Popover v-if="builderMode" class="-mr-2 shrink-0">
        <template #button>
          <Button variant="textonly" size="icon">
            <i class="icon-[lucide--ellipsis-vertical]" />
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col gap-1 p-1">
            <div
              class="flex cursor-pointer items-center gap-4 rounded-sm p-2 hover:bg-secondary-background-hover"
              @click="
                () => {
                  close()
                  startRenameDeferred()
                }
              "
            >
              <i class="icon-[lucide--pencil]" />
              {{ t('g.rename') }}
            </div>
            <div
              class="flex cursor-pointer items-center gap-4 rounded-sm p-2 hover:bg-secondary-background-hover"
              @click="
                () => {
                  close()
                  showUngroupDialog = true
                }
              "
            >
              <i class="icon-[lucide--ungroup]" />
              {{ t('linearMode.layout.ungroup') }}
            </div>
          </div>
        </template>
      </Popover>
      <!-- Ungroup confirmation dialog -->
      <DialogRoot v-model:open="showUngroupDialog">
        <DialogPortal>
          <DialogOverlay class="fixed inset-0 z-1800 bg-black/50" />
          <DialogContent
            class="fixed top-1/2 left-1/2 z-1800 w-80 -translate-1/2 rounded-xl border border-border-subtle bg-base-background p-5 shadow-lg"
          >
            <div class="flex items-center justify-between">
              <DialogTitle class="text-sm font-medium">
                {{ t('linearMode.groups.confirmUngroup') }}
              </DialogTitle>
              <DialogClose
                class="flex size-6 items-center justify-center rounded-sm border-0 bg-transparent text-muted-foreground outline-none hover:text-base-foreground"
              >
                <i class="icon-[lucide--x] size-4" />
              </DialogClose>
            </div>
            <div
              class="mt-3 border-t border-border-subtle pt-3 text-sm text-muted-foreground"
            >
              {{ t('linearMode.groups.ungroupDescription') }}
            </div>
            <div class="mt-5 flex items-center justify-end gap-3">
              <DialogClose as-child>
                <Button variant="muted-textonly" size="sm">
                  {{ t('g.cancel') }}
                </Button>
              </DialogClose>
              <Button
                variant="secondary"
                size="lg"
                @click="
                  () => {
                    handleDissolve()
                    showUngroupDialog = false
                  }
                "
              >
                {{ t('linearMode.layout.ungroup') }}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>
    </div>

    <CollapsibleContent>
      <!-- Builder mode: drop zone -->
      <div
        v-if="builderMode"
        v-group-drop-target="{ groupId: group.id, zoneId }"
        :class="
          cn(
            'flex min-h-10 flex-col gap-3 px-2 pb-2',
            '[&.group-drag-over]:bg-primary-background/5'
          )
        "
      >
        <template
          v-for="row in rows"
          :key="row.type === 'single' ? row.item.key : row.items[0].key"
        >
          <div
            v-if="row.type === 'single'"
            v-group-item-draggable="{
              itemKey: row.item.key,
              groupId: group.id
            }"
            v-group-item-reorder-target="{
              itemKey: row.item.key,
              groupId: group.id
            }"
            class="cursor-grab overflow-hidden rounded-lg p-1.5 [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
          >
            <div class="pointer-events-none" inert>
              <WidgetItem
                :widget="row.item.widget"
                :node="row.item.node"
                hidden-label
                hidden-widget-actions
                hidden-favorite-indicator
              />
            </div>
          </div>
          <div v-else class="flex items-stretch gap-2">
            <div
              v-for="item in row.items"
              :key="item.key"
              v-group-item-draggable="{
                itemKey: item.key,
                groupId: group.id
              }"
              v-group-item-reorder-target="{
                itemKey: item.key,
                groupId: group.id
              }"
              class="min-w-0 flex-1 cursor-grab overflow-hidden rounded-lg p-0.5 [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
            >
              <div class="pointer-events-none" inert>
                <WidgetItem
                  :widget="item.widget"
                  :node="item.node"
                  hidden-label
                  hidden-widget-actions
                  hidden-favorite-indicator
                />
              </div>
            </div>
          </div>
        </template>
        <div
          v-if="group.items.length === 0"
          class="flex items-center justify-center py-3 text-xs text-muted-foreground"
        >
          {{ t('linearMode.arrange.dropHere') }}
        </div>
      </div>

      <!-- App mode: clean read-only -->
      <div v-else class="flex flex-col gap-4 px-4 pt-2 pb-4">
        <template
          v-for="row in rows"
          :key="row.type === 'single' ? row.item.key : row.items[0].key"
        >
          <div v-if="row.type === 'single'">
            <WidgetItem
              :widget="row.item.widget"
              :node="row.item.node"
              hidden-label
              hidden-widget-actions
              @update:widget-value="
                handleWidgetValueUpdate(row.item.widget, $event)
              "
            />
          </div>
          <div v-else class="flex items-stretch gap-2">
            <div
              v-for="item in row.items"
              :key="item.key"
              class="min-w-0 flex-1 overflow-hidden"
            >
              <WidgetItem
                :widget="item.widget"
                :node="item.node"
                hidden-label
                hidden-widget-actions
                class="w-full"
                @update:widget-value="
                  handleWidgetValueUpdate(item.widget, $event)
                "
              />
            </div>
          </div>
        </template>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
