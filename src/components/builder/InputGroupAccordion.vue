<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { computed, nextTick, provide, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UngroupConfirmDialog from '@/components/builder/UngroupConfirmDialog.vue'
import {
  vGroupDropTarget,
  vGroupItemDrag,
  vGroupItemReorder
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
import { useInputGroupStore } from '@/stores/inputGroupStore'
import { HideLayoutFieldKey } from '@/types/widgetTypes'
import type { WidgetValue } from '@/utils/widgetUtil'
import { cn } from '@/utils/tailwindUtil'

const {
  group,
  builderMode = false,
  position = 'middle'
} = defineProps<{
  group: InputGroup
  builderMode?: boolean
  position?: 'first' | 'middle' | 'last' | 'only'
}>()

const { t } = useI18n()
const inputGroupStore = useInputGroupStore()
const canvasStore = useCanvasStore()

provide(HideLayoutFieldKey, true)
provide(OverlayAppendToKey, 'body')

const isOpen = ref(builderMode)
const isRenaming = ref(false)
const renameInputRef = useTemplateRef<HTMLInputElement>('renameInput')

watch(isRenaming, (val) => {
  if (val) {
    nextTick(() => {
      renameInputRef.value?.focus()
      renameInputRef.value?.select()
    })
  }
})
const showUngroupDialog = ref(false)
const renameValue = ref('')
const RENAME_SETTLE_MS = 150
let renameOpenedAt = 0

const displayName = computed(() => group.name ?? autoGroupName(group))
const resolvedItems = computed(() => resolveGroupItems(group))
const rows = computed(() => groupedByPair(resolvedItems.value))

function startRename() {
  if (!builderMode) return
  renameValue.value = displayName.value
  renameOpenedAt = Date.now()
  isRenaming.value = true
}

function confirmRename() {
  // Guard: blur fires immediately on some browsers before the user can type
  if (Date.now() - renameOpenedAt < RENAME_SETTLE_MS) return
  const trimmed = renameValue.value.trim()
  inputGroupStore.renameGroup(group.id, trimmed || null)
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}

function startRenameDeferred() {
  setTimeout(startRename, 50)
}

function handleDissolve() {
  inputGroupStore.deleteGroup(group.id)
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
    <!-- Header row -->
    <div
      :class="
        cn(
          'flex items-center gap-1',
          builderMode ? 'py-1 pr-1.5 pl-1' : 'px-4 py-2'
        )
      "
    >
      <!-- Rename input -->
      <div v-if="isRenaming" class="flex flex-1 items-center gap-1.5 px-3 py-2">
        <input
          ref="renameInput"
          v-model="renameValue"
          type="text"
          class="min-w-0 flex-1 border-none bg-transparent text-sm text-base-foreground outline-none"
          @click.stop
          @keydown.enter.stop="confirmRename"
          @keydown.escape.stop="cancelRename"
          @blur="confirmRename"
        />
      </div>
      <!-- Name + chevron -->
      <CollapsibleTrigger v-else as-child>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-1.5 border border-transparent bg-transparent px-3 py-2 text-left outline-none"
        >
          <span
            :title="displayName"
            class="flex-1 truncate text-sm font-bold text-base-foreground"
            @dblclick.stop="startRename"
          >
            {{ displayName }}
          </span>
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
      <!-- Builder actions -->
      <Popover v-if="builderMode" class="-mr-2 shrink-0">
        <template #button>
          <Button variant="textonly" size="icon">
            <i class="icon-[lucide--ellipsis]" />
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
              {{ t('linearMode.groups.ungroup') }}
            </div>
          </div>
        </template>
      </Popover>
      <UngroupConfirmDialog
        v-model:open="showUngroupDialog"
        @confirm="handleDissolve"
      />
    </div>

    <CollapsibleContent>
      <!-- Builder mode: editable list -->
      <div
        v-if="builderMode"
        v-group-drop-target="{ groupId: group.id }"
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
            v-group-item-drag="{ itemKey: row.item.key, groupId: group.id }"
            v-group-item-reorder="{
              itemKey: row.item.key,
              groupId: group.id
            }"
            class="cursor-grab overflow-hidden rounded-lg p-1.5 [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
          >
            <div class="pointer-events-none" inert>
              <WidgetItem
                :widget="row.item.widget"
                :node="row.item.node"
                hidden-widget-actions
                hidden-favorite-indicator
              />
            </div>
          </div>
          <div v-else class="flex items-stretch gap-2">
            <div
              v-for="item in row.items"
              :key="item.key"
              v-group-item-drag="{ itemKey: item.key, groupId: group.id }"
              v-group-item-reorder="{
                itemKey: item.key,
                groupId: group.id
              }"
              class="min-w-0 flex-1 cursor-grab overflow-hidden rounded-lg p-0.5 [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
            >
              <div class="pointer-events-none" inert>
                <WidgetItem
                  :widget="item.widget"
                  :node="item.node"
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
          {{ t('linearMode.groups.emptyGroup') }}
        </div>
      </div>

      <!-- App mode: interactive widgets -->
      <div v-else class="flex flex-col gap-4 px-4 pt-2 pb-4">
        <template
          v-for="row in rows"
          :key="row.type === 'single' ? row.item.key : row.items[0].key"
        >
          <div v-if="row.type === 'single'">
            <WidgetItem
              :widget="row.item.widget"
              :node="row.item.node"
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
