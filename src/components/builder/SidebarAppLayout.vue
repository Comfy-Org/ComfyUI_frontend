<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import InputGroupAccordion from '@/components/builder/InputGroupAccordion.vue'
import {
  inputItemKey,
  parseGroupItemKey
} from '@/components/builder/itemKeyHelper'
import LayoutZoneGrid from '@/components/builder/LayoutZoneGrid.vue'
import { getTemplate } from '@/components/builder/layoutTemplates'
import { useBuilderRename } from '@/components/builder/useBuilderRename'
import { vGroupDraggable } from '@/components/builder/useGroupDrop'
import { useLinearRunPrompt } from '@/components/builder/useLinearRunPrompt'
import {
  vWidgetDraggable,
  vZoneDropTarget
} from '@/components/builder/useZoneDrop'
import { vZoneItemReorderTarget } from '@/components/builder/useWidgetReorder'
import type { ResolvedArrangeWidget } from '@/components/builder/useZoneWidgets'
import { useArrangeZoneWidgets } from '@/components/builder/useZoneWidgets'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import WidgetItem from '@/components/rightSidePanel/parameters/WidgetItem.vue'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { InputGroup } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import PartnerNodesList from '@/renderer/extensions/linearMode/PartnerNodesList.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

provide(HideLayoutFieldKey, true)

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { runPrompt } = useLinearRunPrompt()
const settingStore = useSettingStore()
const { batchCount } = storeToRefs(useQueueSettingsStore())
const { isBuilderMode } = useAppMode()

const activeTemplate = computed(
  () => getTemplate(appModeStore.layoutTemplateId) ?? getTemplate('single')!
)

/** The zone where run controls should render (last zone = right column in dual). */
const runZoneId = computed(() => {
  const zones = activeTemplate.value.zones
  return zones.at(-1)?.id ?? zones[0]?.id ?? ''
})

// Builder mode: draggable zone widgets
const zoneWidgets = useArrangeZoneWidgets()

onMounted(() => {
  if (isBuilderMode.value) appModeStore.autoAssignInputs()
})

const widgetsByKey = computed(() => {
  const map = new Map<string, ResolvedArrangeWidget>()
  for (const [, widgets] of zoneWidgets.value) {
    for (const w of widgets) map.set(inputItemKey(w.nodeId, w.widgetName), w)
  }
  return map
})

function getOrderedItems(zoneId: string) {
  const widgets = zoneWidgets.value.get(zoneId) ?? []
  const hasRun = zoneId === appModeStore.runControlsZoneId
  return appModeStore.getZoneItems(zoneId, [], widgets, hasRun, false)
}

const {
  renamingKey,
  renameValue,
  startRename: startRenameInput,
  confirmRename: confirmRenameInput,
  cancelRename: cancelRenameInput,
  startRenameDeferred: startRenameInputDeferred
} = useBuilderRename((key) => widgetsByKey.value.get(key))

const showRemoveDialog = ref(false)
const pendingRemove = ref<{ nodeId: NodeId; widgetName: string } | null>(null)

function confirmRemoveInput(nodeId: NodeId, widgetName: string) {
  pendingRemove.value = { nodeId, widgetName }
  showRemoveDialog.value = true
}

function removeInput() {
  if (!pendingRemove.value) return
  const { nodeId, widgetName } = pendingRemove.value
  const idx = appModeStore.selectedInputs.findIndex(
    ([nId, wName]) => nId === nodeId && wName === widgetName
  )
  if (idx !== -1) appModeStore.selectedInputs.splice(idx, 1)
  showRemoveDialog.value = false
  pendingRemove.value = null
}

function findGroupById(itemKey: string) {
  const groupId = parseGroupItemKey(itemKey)
  if (!groupId) return undefined
  return appModeStore.inputGroups.find((g) => g.id === groupId)
}

type ZoneSegment =
  | { type: 'inputs'; keys: string[] }
  | { type: 'group'; group: InputGroup }

function getZoneSegments(zoneId: string): ZoneSegment[] {
  const items = getOrderedItems(zoneId)
  const segments: ZoneSegment[] = []
  let currentInputKeys: string[] = []

  function flushInputs() {
    if (currentInputKeys.length > 0) {
      segments.push({ type: 'inputs', keys: [...currentInputKeys] })
      currentInputKeys = []
    }
  }

  for (const key of items) {
    if (key.startsWith('input:')) {
      currentInputKeys.push(key)
    } else if (key.startsWith('group:')) {
      const group = findGroupById(key)
      if (group && (isBuilderMode.value || group.items.length >= 1)) {
        flushInputs()
        segments.push({ type: 'group', group })
      }
    }
  }
  flushInputs()
  return segments
}

function groupPosition(
  group: InputGroup,
  segments: ZoneSegment[]
): 'first' | 'middle' | 'last' | 'only' {
  const groupSegments = segments.filter(
    (s): s is ZoneSegment & { type: 'group' } => s.type === 'group'
  )
  const idx = groupSegments.findIndex((s) => s.group.id === group.id)
  const total = groupSegments.length
  const isFirst = idx === 0 && !segments.some((s) => s.type === 'inputs')
  if (total === 1) return isFirst ? 'only' : 'last'
  if (isFirst) return 'first'
  if (idx === total - 1) return 'last'
  return 'middle'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Inputs area -->
    <div class="flex min-h-0 flex-1 flex-col bg-comfy-menu-bg px-2">
      <!-- === ZONE GRID (always — single or dual) === -->
      <LayoutZoneGrid
        :template="activeTemplate"
        :grid-overrides="appModeStore.gridOverrides"
        :dashed="isBuilderMode"
        class="min-h-0 flex-1"
      >
        <template #zone="{ zone }">
          <div class="flex size-full flex-col" :data-zone-id="zone.id">
            <!-- Inputs (scrollable, order matches builder mode) -->
            <div
              v-if="!isBuilderMode"
              class="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              <div>
                <template
                  v-for="(segment, sIdx) in getZoneSegments(zone.id)"
                  :key="
                    segment.type === 'inputs'
                      ? `inputs-${sIdx}`
                      : `group-${segment.group.id}`
                  "
                >
                  <AppModeWidgetList
                    v-if="segment.type === 'inputs'"
                    :item-keys="segment.keys"
                  />
                  <InputGroupAccordion
                    v-else
                    :group="segment.group"
                    :zone-id="zone.id"
                    :position="
                      groupPosition(segment.group, getZoneSegments(zone.id))
                    "
                  />
                </template>
              </div>
            </div>

            <!-- Builder mode: draggable zone content (scrollable, short content hugs bottom) -->
            <div
              v-else
              v-zone-drop-target="zone.id"
              class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 [&.zone-drag-over]:bg-primary-background/10 [&.zone-drag-over]:ring-2 [&.zone-drag-over]:ring-primary-background [&.zone-drag-over]:ring-inset"
            >
              <template
                v-for="itemKey in getOrderedItems(zone.id)"
                :key="itemKey"
              >
                <!-- Input widget -->
                <div
                  v-if="
                    itemKey.startsWith('input:') && widgetsByKey.get(itemKey)
                  "
                  v-widget-draggable="{
                    nodeId: widgetsByKey.get(itemKey)!.nodeId,
                    widgetName: widgetsByKey.get(itemKey)!.widgetName,
                    zone: zone.id
                  }"
                  v-zone-item-reorder-target="{
                    itemKey,
                    zone: zone.id
                  }"
                  class="shrink-0 cursor-grab overflow-hidden rounded-lg border border-dashed border-border-subtle p-2 [&.pair-indicator]:ring-2 [&.pair-indicator]:ring-primary-background [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
                >
                  <!-- Builder menu -->
                  <div class="mb-1 flex items-center gap-1">
                    <div
                      v-if="renamingKey === itemKey"
                      class="flex flex-1 items-center"
                    >
                      <input
                        v-model="renameValue"
                        type="text"
                        class="min-w-0 flex-1 border-none bg-transparent text-sm text-base-foreground outline-none"
                        @click.stop
                        @keydown.enter.stop="confirmRenameInput"
                        @keydown.escape.stop="cancelRenameInput"
                        @blur="confirmRenameInput"
                        @vue:mounted="
                          ($event: any) => {
                            $event.el?.focus()
                            $event.el?.select()
                          }
                        "
                      />
                    </div>
                    <span
                      v-else
                      class="flex-1 truncate text-sm text-muted-foreground"
                      @dblclick.stop="startRenameInput(itemKey)"
                    >
                      {{
                        widgetsByKey.get(itemKey)!.widget.label ||
                        widgetsByKey.get(itemKey)!.widget.name
                      }}
                      —
                      {{ widgetsByKey.get(itemKey)!.node.title }}
                    </span>
                    <Popover class="pointer-events-auto shrink-0">
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
                                startRenameInputDeferred(itemKey)
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
                                confirmRemoveInput(
                                  widgetsByKey.get(itemKey)!.nodeId,
                                  widgetsByKey.get(itemKey)!.widgetName
                                )
                                close()
                              }
                            "
                          >
                            <i class="icon-[lucide--x]" />
                            {{ t('g.remove') }}
                          </div>
                        </div>
                      </template>
                    </Popover>
                  </div>
                  <div class="pointer-events-none" inert>
                    <WidgetItem
                      :widget="widgetsByKey.get(itemKey)!.widget"
                      :node="widgetsByKey.get(itemKey)!.node"
                      hidden-label
                    />
                  </div>
                </div>
                <!-- Group accordion -->
                <div
                  v-else-if="
                    itemKey.startsWith('group:') && findGroupById(itemKey)
                  "
                  v-group-draggable="{
                    groupId: findGroupById(itemKey)!.id,
                    zone: zone.id
                  }"
                  v-zone-item-reorder-target="{
                    itemKey,
                    zone: zone.id
                  }"
                  class="shrink-0 [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
                >
                  <InputGroupAccordion
                    :group="findGroupById(itemKey)!"
                    :zone-id="zone.id"
                    builder-mode
                  />
                </div>
                <!-- Run controls handled below, pinned to zone bottom -->
              </template>
              <!-- Empty state -->
              <div
                v-if="getOrderedItems(zone.id).length === 0"
                class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
              >
                <i class="mr-2 icon-[lucide--plus] size-4" />
                {{ t('linearMode.arrange.dropHere') }}
              </div>
            </div>

            <!-- Create group (pinned below scroll, builder only) -->
            <button
              v-if="isBuilderMode"
              type="button"
              class="group/cg flex w-full shrink-0 items-center justify-between border-0 border-t border-border-subtle/40 bg-transparent py-4 pr-5 pl-4 text-sm text-base-foreground outline-none"
              @click="appModeStore.createGroup(zone.id)"
            >
              {{ t('linearMode.groups.createGroup') }}
              <i
                class="icon-[lucide--plus] size-5 text-muted-foreground group-hover/cg:text-base-foreground"
              />
            </button>

            <!-- Run controls (pinned to bottom of last zone, both modes) -->
            <section
              v-if="zone.id === runZoneId"
              data-testid="linear-run-controls"
              :class="[
                'mt-auto shrink-0 border-t p-4 pb-6',
                isBuilderMode
                  ? 'border-border-subtle/40'
                  : 'mx-3 border-border-subtle'
              ]"
            >
              <div class="flex items-center justify-between gap-4">
                <span
                  class="shrink-0 text-sm text-node-component-slot-text"
                  v-text="t('linearMode.runCount')"
                />
                <ScrubableNumberInput
                  v-model="batchCount"
                  :aria-label="t('linearMode.runCount')"
                  :min="1"
                  :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
                  class="h-7 max-w-[35%] min-w-fit flex-1"
                />
              </div>
              <Button
                variant="primary"
                class="mt-4 w-full text-sm"
                size="lg"
                data-testid="linear-run-button"
                @click="runPrompt"
              >
                <i class="icon-[lucide--play]" />
                {{ t('menu.run') }}
              </Button>
            </section>
          </div>
        </template>
      </LayoutZoneGrid>

      <PartnerNodesList />
    </div>

    <BuilderConfirmDialog
      v-model="showRemoveDialog"
      :title="t('linearMode.groups.confirmRemove')"
      :description="t('linearMode.groups.removeDescription')"
      :confirm-label="t('g.remove')"
      confirm-variant="destructive"
      @confirm="removeInput"
    />
  </div>
</template>
