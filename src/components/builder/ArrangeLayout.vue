<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import LayoutZoneGrid from '@/components/builder/LayoutZoneGrid.vue'
import { getTemplate } from '@/components/builder/layoutTemplates'
import {
  OUTPUT_ZONE_KEY,
  useArrangeZoneWidgets
} from '@/components/builder/useZoneWidgets'
import type { ResolvedArrangeWidget } from '@/components/builder/useZoneWidgets'
import {
  vOutputDraggable,
  vPresetStripDraggable,
  vRunControlsDraggable,
  vWidgetDraggable,
  vZoneDropTarget
} from '@/components/builder/useZoneDrop'
import {
  vZoneReorderDraggable,
  vZoneReorderDropTarget
} from '@/components/builder/useZoneReorder'
import { vZoneItemReorderTarget } from '@/components/builder/useWidgetReorder'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import Button from '@/components/ui/button/Button.vue'
import WidgetItem from '@/components/rightSidePanel/parameters/WidgetItem.vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { resolveNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const commandStore = useCommandStore()
const settingStore = useSettingStore()
const queueSettingsStore = useQueueSettingsStore()

const template = computed(
  () => getTemplate(appModeStore.layoutTemplateId) ?? getTemplate('sidebar')!
)

const zoneWidgets = useArrangeZoneWidgets()

const runControlsZoneId = computed(() => {
  if (appModeStore.runControlsZoneId) return appModeStore.runControlsZoneId
  const zones = template.value.zones
  const inputZones = zones.filter((z) => !z.isOutput)
  return inputZones.at(-1)?.id ?? zones.at(-1)?.id ?? ''
})

const presetStripZoneId = computed(() => {
  if (appModeStore.presetStripZoneId) return appModeStore.presetStripZoneId
  const zones = template.value.zones
  const inputZones = zones.filter((z) => !z.isOutput)
  return inputZones.at(0)?.id ?? zones.at(0)?.id ?? ''
})

onMounted(() => appModeStore.autoAssignInputs())

async function runPrompt(e: Event) {
  const commandId =
    e instanceof MouseEvent && e.shiftKey
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'
  try {
    await commandStore.execute(commandId, {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (err) {
    useToastStore().addAlert(t('linearMode.arrange.queueFailed'))
  }
}

/** Zone number for non-empty zones (1-based, skips empty). */
const zoneNumbers = computed(() => {
  const map = new Map<string, number>()
  let num = 1
  for (const zone of template.value.zones) {
    const items = getOrderedItems(zone.id)
    if (items.length > 0) {
      map.set(zone.id, num++)
    }
  }
  return map
})

/** Pre-computed output nodes per zone. */
const zoneOutputs = computed(() => {
  const map = new Map<string, { nodeId: NodeId; node: LGraphNode }[]>()

  for (const zone of template.value.zones) {
    const outputs = appModeStore.selectedOutputs
      .filter((nodeId) => {
        const assigned = appModeStore.getZone(nodeId, OUTPUT_ZONE_KEY)
        if (assigned) return assigned === zone.id
        return zone.isOutput ?? false
      })
      .map((nodeId) => {
        const node = resolveNode(nodeId)
        return node ? { nodeId, node } : null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    map.set(zone.id, outputs)
  }
  return map
})

/** Lookup maps for rendering items by key. */
const outputsByKey = computed(() => {
  const map = new Map<string, { nodeId: NodeId; node: LGraphNode }>()
  for (const [, outputs] of zoneOutputs.value) {
    for (const o of outputs) map.set(`output:${o.nodeId}`, o)
  }
  return map
})

const widgetsByKey = computed(() => {
  const map = new Map<string, ResolvedArrangeWidget>()
  for (const [, widgets] of zoneWidgets.value) {
    for (const w of widgets) map.set(`input:${w.nodeId}:${w.widgetName}`, w)
  }
  return map
})

/** Unified ordered item list per zone. */
function getOrderedItems(zoneId: string) {
  const outputs = zoneOutputs.value.get(zoneId) ?? []
  const widgets = zoneWidgets.value.get(zoneId) ?? []
  const hasRun = zoneId === runControlsZoneId.value
  const hasPreset =
    appModeStore.presetsEnabled && zoneId === presetStripZoneId.value
  return appModeStore.getZoneItems(zoneId, outputs, widgets, hasRun, hasPreset)
}
</script>

<template>
  <div class="mx-auto flex size-full max-w-[90%] flex-col pt-20 pb-16">
    <LayoutZoneGrid
      :template="template"
      :grid-overrides="appModeStore.gridOverrides"
      :resizable="true"
      class="min-h-0 flex-1"
    >
      <template #zone="{ zone }">
        <div
          v-zone-reorder-drop-target="zone.id"
          class="size-full [&.zone-reorder-over]:rounded-xl [&.zone-reorder-over]:bg-primary-background/10 [&.zone-reorder-over]:ring-2 [&.zone-reorder-over]:ring-primary-background [&.zone-reorder-over]:ring-inset"
        >
          <div
            v-zone-drop-target="zone.id"
            :class="
              cn(
                'flex size-full flex-col gap-2 p-2 [&.zone-drag-over]:bg-primary-background/10 [&.zone-drag-over]:ring-2 [&.zone-drag-over]:ring-primary-background [&.zone-drag-over]:ring-inset',
                (appModeStore.zoneAlign[zone.id] ?? 'top') === 'bottom' &&
                  'justify-end'
              )
            "
            :data-zone-id="zone.id"
          >
            <!-- Zone drag handle with number badge + align toggle -->
            <div class="flex shrink-0 items-center gap-2 rounded-sm py-0.5">
              <div
                v-if="zoneNumbers.get(zone.id)"
                v-tooltip.bottom="
                  t('linearMode.arrange.mobileOrder', {
                    order: zoneNumbers.get(zone.id)
                  })
                "
                class="flex size-5 items-center justify-center rounded-full border border-muted-foreground/30 text-[10px] font-bold text-muted-foreground"
              >
                {{ zoneNumbers.get(zone.id) }}
              </div>
              <div
                v-zone-reorder-draggable="zone.id"
                class="flex flex-1 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground"
              >
                <i class="icon-[lucide--grip-horizontal] size-4" />
              </div>
              <button
                v-tooltip.bottom="
                  (appModeStore.zoneAlign[zone.id] ?? 'top') === 'top'
                    ? t('linearMode.arrange.alignToBottom')
                    : t('linearMode.arrange.alignToTop')
                "
                type="button"
                :aria-label="
                  (appModeStore.zoneAlign[zone.id] ?? 'top') === 'top'
                    ? t('linearMode.arrange.alignToBottom')
                    : t('linearMode.arrange.alignToTop')
                "
                class="flex size-5 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
                @click="appModeStore.toggleZoneAlign(zone.id)"
              >
                <i
                  class="icon-[lucide--triangle] size-4 text-muted-foreground/50 transition-transform duration-300 ease-in-out"
                  :class="
                    (appModeStore.zoneAlign[zone.id] ?? 'top') === 'bottom'
                      ? 'rotate-180'
                      : ''
                  "
                />
              </button>
            </div>
            <!-- Unified item list — outputs, inputs, run controls in any order -->
            <template
              v-for="itemKey in getOrderedItems(zone.id)"
              :key="itemKey"
            >
              <!-- Output node -->
              <div
                v-if="
                  itemKey.startsWith('output:') && outputsByKey.get(itemKey)
                "
                v-output-draggable="{
                  nodeId: outputsByKey.get(itemKey)!.nodeId,
                  zone: zone.id
                }"
                v-zone-item-reorder-target="{
                  itemKey,
                  zone: zone.id,
                  order: getOrderedItems(zone.id)
                }"
                class="flex min-h-0 flex-1 cursor-grab items-center justify-center gap-2 rounded-lg border border-dashed border-warning-background/50 bg-warning-background/10 px-3 py-2 text-sm [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
              >
                <i
                  class="icon-[lucide--image] size-5 text-warning-background"
                />
                <span>{{
                  outputsByKey.get(itemKey)!.node.title ||
                  outputsByKey.get(itemKey)!.node.type
                }}</span>
              </div>
              <!-- Input widget -->
              <div
                v-else-if="
                  itemKey.startsWith('input:') && widgetsByKey.get(itemKey)
                "
                v-widget-draggable="{
                  nodeId: widgetsByKey.get(itemKey)!.nodeId,
                  widgetName: widgetsByKey.get(itemKey)!.widgetName,
                  zone: zone.id
                }"
                v-zone-item-reorder-target="{
                  itemKey,
                  zone: zone.id,
                  order: getOrderedItems(zone.id)
                }"
                class="shrink-0 cursor-grab overflow-hidden rounded-lg border border-dashed border-border-subtle p-2 [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
              >
                <div class="pointer-events-none" inert>
                  <WidgetItem
                    :widget="widgetsByKey.get(itemKey)!.widget"
                    :node="widgetsByKey.get(itemKey)!.node"
                    show-node-name
                  />
                </div>
              </div>
              <!-- Preset strip -->
              <div
                v-else-if="itemKey === 'preset-strip'"
                v-preset-strip-draggable="zone.id"
                v-zone-item-reorder-target="{
                  itemKey,
                  zone: zone.id,
                  order: getOrderedItems(zone.id)
                }"
                class="flex cursor-grab items-center gap-2 rounded-lg border border-dashed border-primary-background/30 px-3 py-2 text-sm text-muted-foreground [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
              >
                <i class="icon-[lucide--layers] size-4" />
                {{ t('linearMode.presets.label') }}
              </div>
              <!-- Run controls -->
              <div
                v-else-if="itemKey === 'run-controls'"
                v-run-controls-draggable="zone.id"
                v-zone-item-reorder-target="{
                  itemKey,
                  zone: zone.id,
                  order: getOrderedItems(zone.id)
                }"
                class="flex cursor-grab flex-col items-center gap-2 rounded-lg border border-dashed border-primary-background/30 p-3 [&.reorder-after]:border-b-2 [&.reorder-after]:border-b-primary-background [&.reorder-before]:border-t-2 [&.reorder-before]:border-t-primary-background"
              >
                <div class="flex w-full flex-col gap-1">
                  <span
                    class="text-xs text-muted-foreground"
                    v-text="t('linearMode.runCount')"
                  />
                  <ScrubableNumberInput
                    v-model="queueSettingsStore.batchCount"
                    :aria-label="t('linearMode.runCount')"
                    :min="1"
                    :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
                    class="h-10 w-full"
                  />
                </div>
                <Button
                  v-tooltip.top="t('linearMode.arrange.shiftClickPriority')"
                  variant="primary"
                  size="lg"
                  class="w-full"
                  @click="runPrompt"
                >
                  <i class="icon-[lucide--play] size-4" />
                  {{ t('menu.run') }}
                </Button>
              </div>
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
        </div>
      </template>
    </LayoutZoneGrid>
  </div>
</template>
