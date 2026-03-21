<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ImageLightbox from '@/components/common/ImageLightbox.vue'
import LayoutZoneGrid from '@/components/builder/LayoutZoneGrid.vue'
import PresetStrip from '@/components/builder/PresetStrip.vue'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import { getTemplate } from '@/components/builder/layoutTemplates'
import type { EnrichedNodeData } from '@/components/builder/useZoneWidgets'
import {
  OUTPUT_ZONE_KEY,
  useAppZoneWidgets
} from '@/components/builder/useZoneWidgets'
import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import DropZone from '@/renderer/extensions/linearMode/DropZone.vue'
import MediaOutputPreview from '@/renderer/extensions/linearMode/MediaOutputPreview.vue'
import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { ResultItemImpl } from '@/stores/queueStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

import { cn } from '@/utils/tailwindUtil'

const { selectedOutput } = defineProps<{
  selectedOutput?: ResultItemImpl
}>()

const { t } = useI18n()
const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')
const appModeStore = useAppModeStore()
const commandStore = useCommandStore()
const nodeOutputStore = useNodeOutputStore()
const settingStore = useSettingStore()
const { batchCount } = storeToRefs(useQueueSettingsStore())
const { nodeIdToNodeLocatorId } = useWorkflowStore()

const template = computed(
  () => getTemplate(appModeStore.layoutTemplateId) ?? getTemplate('sidebar')!
)

const zoneWidgets = useAppZoneWidgets()

const runControlsZoneId = computed(() => {
  if (appModeStore.runControlsZoneId) return appModeStore.runControlsZoneId
  if (template.value.defaultRunControlsZone)
    return template.value.defaultRunControlsZone
  const zones = template.value.zones
  const inputZones = zones.filter((z) => !z.isOutput)
  return inputZones.at(-1)?.id ?? zones.at(-1)?.id ?? ''
})

const presetStripZoneId = computed(() => {
  if (appModeStore.presetStripZoneId) return appModeStore.presetStripZoneId
  if (template.value.defaultPresetStripZone)
    return template.value.defaultPresetStripZone
  const zones = template.value.zones
  const inputZones = zones.filter((z) => !z.isOutput)
  return inputZones.at(0)?.id ?? zones.at(0)?.id ?? ''
})

/** Per-zone output results — each zone gets its own assigned outputs. */
const liveZoneOutputs = computed(() => {
  const map = new Map<string, ReturnType<typeof flattenNodeOutput>>()

  for (const zone of template.value.zones) {
    const outputs: ReturnType<typeof flattenNodeOutput> = []
    for (const nodeId of appModeStore.selectedOutputs) {
      const assigned = appModeStore.getZone(nodeId, OUTPUT_ZONE_KEY)
      if (!assigned && !zone.isOutput) continue
      if (assigned && assigned !== zone.id) continue

      const locatorId = nodeIdToNodeLocatorId(nodeId)
      const nodeOutput = nodeOutputStore.nodeOutputs[locatorId]
      if (!nodeOutput) continue
      outputs.push(...flattenNodeOutput([nodeId, nodeOutput]))
    }
    if (outputs.length > 0) map.set(zone.id, outputs)
  }
  return map
})

/** When a history item is selected, show it in the first output zone. */
const zoneOutputs = computed(() => {
  if (!selectedOutput) return liveZoneOutputs.value

  const map = new Map(liveZoneOutputs.value)
  const outputZone =
    template.value.zones.find((z) => z.isOutput)?.id ??
    template.value.zones.at(-1)?.id ??
    ''
  map.set(outputZone, [selectedOutput])
  return map
})

/** Per-zone output node count for placeholders (before results arrive). */
const zoneOutputNodeCount = computed(() => {
  const counts = new Map<string, number>()
  for (const nodeId of appModeStore.selectedOutputs) {
    const assigned = appModeStore.getZone(nodeId, OUTPUT_ZONE_KEY)
    if (assigned) {
      counts.set(assigned, (counts.get(assigned) ?? 0) + 1)
    }
  }
  // Fallback: if no explicit assignments, use default isOutput zones
  if (counts.size === 0) {
    for (const z of template.value.zones) {
      if (z.isOutput) counts.set(z.id, appModeStore.selectedOutputs.length)
    }
  }
  return counts
})

/** Build output items list for getZoneItems compatibility. */
function outputItemsForZone(zoneId: string) {
  return appModeStore.selectedOutputs
    .filter((nodeId) => {
      const assigned = appModeStore.getZone(nodeId, OUTPUT_ZONE_KEY)
      if (assigned) return assigned === zoneId
      const zone = template.value.zones.find((z) => z.id === zoneId)
      return zone?.isOutput ?? false
    })
    .map((nodeId) => ({ nodeId }))
}

interface ZoneRenderItem {
  key: string
  type: 'output' | 'input' | 'run-controls' | 'preset-strip'
  /** For input items: the nodeData with widgets filtered to only this group. */
  nodeData?: EnrichedNodeData
  /** For output items: the output node ID from the ordered key. */
  outputNodeId?: string
}

/** Build deduplicated render items for a zone. Groups input keys by node. */
function getZoneRenderItems(zoneId: string): ZoneRenderItem[] {
  const outputs = outputItemsForZone(zoneId)
  const widgets = (zoneWidgets.value.get(zoneId) ?? []).flatMap((nd) =>
    (nd.widgets ?? []).map((w) => ({
      nodeId: String(nd.id),
      widgetName: w.name
    }))
  )
  const hasRun = zoneId === runControlsZoneId.value
  const hasPreset =
    appModeStore.presetsEnabled && zoneId === presetStripZoneId.value
  const orderedKeys = appModeStore.getZoneItems(
    zoneId,
    outputs,
    widgets,
    hasRun,
    hasPreset
  )

  const nodeDataMap = new Map<string, EnrichedNodeData>()
  for (const nd of zoneWidgets.value.get(zoneId) ?? []) {
    nodeDataMap.set(String(nd.id), nd)
  }

  const items: ZoneRenderItem[] = []
  const renderedNodes = new Set<string>()

  for (const key of orderedKeys) {
    if (key === 'preset-strip') {
      items.push({ key, type: 'preset-strip' })
    } else if (key === 'run-controls') {
      items.push({ key, type: 'run-controls' })
    } else if (key.startsWith('output:')) {
      items.push({ key, type: 'output', outputNodeId: key.split(':')[1] })
    } else if (key.startsWith('input:')) {
      const nodeId = key.split(':')[1]
      if (renderedNodes.has(nodeId)) continue
      renderedNodes.add(nodeId)

      const nd = nodeDataMap.get(nodeId)
      if (!nd) continue

      // Collect all widget names for this node from the ordered keys
      const nodeWidgetNames = new Set(
        orderedKeys
          .filter((k) => k.startsWith(`input:${nodeId}:`))
          .map((k) => k.split(':').slice(2).join(':'))
      )

      // Filter nodeData widgets to only the ones in this zone
      const filteredWidgets = (nd.widgets ?? []).filter((w) =>
        nodeWidgetNames.has(w.name)
      )

      items.push({
        key: `input-group:${nodeId}`,
        type: 'input',
        nodeData: { ...nd, widgets: filteredWidgets }
      })
    }
  }

  return items
}

/** Zones that have any content (inputs, outputs, or run controls). */
const filledZones = computed(() => {
  const filled = new Set<string>()
  for (const zone of template.value.zones) {
    const hasWidgets = (zoneWidgets.value.get(zone.id)?.length ?? 0) > 0
    const hasSelectedOutput = selectedOutput && zone.isOutput
    const hasOutputs =
      hasSelectedOutput ||
      zoneOutputs.value.has(zone.id) ||
      zoneOutputNodeCount.value.has(zone.id)
    const hasRun = zone.id === runControlsZoneId.value
    const hasPreset =
      appModeStore.presetsEnabled && zone.id === presetStripZoneId.value
    if (hasWidgets || hasOutputs || hasRun || hasPreset) filled.add(zone.id)
  }
  return filled
})

/** Border style for a zone using ring (inset, no overflow clipping). */
function zoneBorderClass(zoneId: string): string {
  if (!filledZones.value.has(zoneId)) return ''
  return 'rounded-xl ring-2 ring-border-subtle ring-inset'
}

/** Apply bg-black to grid cells that are showing output content. */
const outputZoneClasses = computed(() => {
  const classes: Record<string, string> = {}
  for (const zone of template.value.zones) {
    if (zoneOutputs.value.has(zone.id)) {
      classes[zone.id] = 'bg-black'
    }
  }
  return classes
})

const lightboxSrc = ref('')
const lightboxOpen = ref(false)

function openLightbox(url: string) {
  lightboxSrc.value = url
  lightboxOpen.value = true
}

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
</script>

<template>
  <!-- Mobile: single stacked column -->
  <div
    v-if="isMobile"
    class="flex size-full flex-col gap-4 overflow-y-auto p-4"
  >
    <template v-for="zone in template.zones" :key="zone.id">
      <div
        v-if="filledZones.has(zone.id)"
        class="flex flex-col gap-2 rounded-xl border-2 border-solid border-border-subtle p-3"
      >
        <!-- Output preview -->
        <div
          v-if="zoneOutputs.has(zone.id) || zoneOutputNodeCount.has(zone.id)"
          :class="
            cn(
              'overflow-hidden rounded-lg border border-warning-background/50',
              (zoneOutputs.get(zone.id)?.length ?? 0) === 0 &&
                'bg-warning-background/5 p-4'
            )
          "
        >
          <div
            v-if="(zoneOutputs.get(zone.id)?.length ?? 0) > 0"
            class="flex flex-col gap-2"
          >
            <button
              v-for="(output, idx) in zoneOutputs.get(zone.id)"
              :key="idx"
              type="button"
              class="cursor-pointer"
              @dblclick="output.url && openLightbox(output.url)"
            >
              <MediaOutputPreview :output="output" />
            </button>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground"
          >
            <i class="icon-[lucide--image] size-6 text-warning-background/50" />
            <p class="text-xs">
              {{ t('linearMode.arrange.resultsLabel') }}
            </p>
          </div>
        </div>
        <!-- Input widgets -->
        <template
          v-for="nodeData of zoneWidgets.get(zone.id) ?? []"
          :key="nodeData.id"
        >
          <DropZone
            :on-drag-over="nodeData.onDragOver"
            :on-drag-drop="nodeData.onDragDrop"
            :drop-indicator="nodeData.dropIndicator"
          >
            <NodeWidgets
              :node-data
              class="gap-y-3 rounded-lg py-3 *:has-[textarea]:h-50 **:[.col-span-2]:grid-cols-1 **:[.h-7]:h-10"
            />
          </DropZone>
        </template>
        <!-- Run controls -->
        <div
          v-if="zone.id === runControlsZoneId"
          class="flex flex-col gap-2 border-t border-border-subtle pt-3"
        >
          <div class="flex w-full flex-col gap-1">
            <span
              class="text-xs text-muted-foreground"
              v-text="t('linearMode.runCount')"
            />
            <ScrubableNumberInput
              v-model="batchCount"
              :aria-label="t('linearMode.runCount')"
              :min="1"
              :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
              class="h-10 w-full"
            />
          </div>
          <Button
            v-tooltip.top="t('linearMode.arrange.shiftClickPriority')"
            data-testid="linear-run-button"
            variant="primary"
            size="lg"
            class="w-full"
            @click="runPrompt"
          >
            <i class="icon-[lucide--play] size-4" />
            {{ t('menu.run') }}
          </Button>
        </div>
      </div>
    </template>
  </div>
  <!-- Desktop: grid layout -->
  <div
    v-else
    data-testid="linear-widgets"
    class="mx-auto flex size-full min-h-0 max-w-[90%] flex-col overflow-hidden px-4 pt-12 pb-4"
  >
    <LayoutZoneGrid
      :template="template"
      :dashed="false"
      :grid-overrides="appModeStore.gridOverrides"
      :filled-zones="filledZones"
      :zone-classes="outputZoneClasses"
      class="min-h-0"
    >
      <template #zone="{ zone }">
        <!-- Outer: full cell height, alignment controlled per zone -->
        <div
          :class="
            cn(
              'flex size-full min-h-0 flex-col',
              (appModeStore.zoneAlign[zone.id] ?? 'top') === 'bottom'
                ? 'justify-end'
                : 'justify-start',
              zoneOutputs.has(zone.id) && 'rounded-xl bg-black'
            )
          "
        >
          <!-- Inner: border wraps content, scrolls when needed -->
          <div
            :class="
              cn(
                'flex min-h-0 flex-col overflow-y-auto',
                zoneBorderClass(zone.id),
                zoneOutputs.has(zone.id) || zoneOutputNodeCount.has(zone.id)
                  ? 'flex-1'
                  : '',
                zoneOutputs.has(zone.id) ? 'bg-black' : 'gap-2 p-2'
              )
            "
          >
            <!-- History selection: show in output zone when no builder outputs -->
            <button
              v-if="
                selectedOutput &&
                zone.isOutput &&
                !getZoneRenderItems(zone.id).some((i) => i.type === 'output')
              "
              type="button"
              class="min-h-0 flex-1 cursor-pointer overflow-hidden rounded-lg border border-warning-background/50 bg-black"
              @dblclick="selectedOutput.url && openLightbox(selectedOutput.url)"
            >
              <MediaOutputPreview
                :output="selectedOutput"
                class="size-full [&_span]:hidden"
              />
            </button>
            <!-- Unified item order — deduplicated by node -->
            <template
              v-for="item in getZoneRenderItems(zone.id)"
              :key="item.key"
            >
              <!-- Output node (one per output:nodeId key) -->
              <div
                v-if="item.type === 'output'"
                :class="
                  cn(
                    'min-h-0 flex-1 overflow-hidden rounded-lg border border-warning-background/50',
                    (zoneOutputs.get(zone.id) ?? []).some(
                      (o) => String(o.nodeId) === item.outputNodeId
                    )
                      ? 'bg-black'
                      : 'bg-warning-background/5 p-4'
                  )
                "
              >
                <template
                  v-for="(output, idx) in zoneOutputs.get(zone.id) ?? []"
                  :key="idx"
                >
                  <button
                    v-if="String(output.nodeId) === item.outputNodeId"
                    type="button"
                    class="flex min-h-0 flex-1 cursor-pointer overflow-hidden"
                    @dblclick="output.url && openLightbox(output.url)"
                  >
                    <MediaOutputPreview
                      :output="output"
                      class="size-full bg-black [&_div]:bg-black [&_span]:hidden"
                    />
                  </button>
                </template>
                <div
                  v-if="
                    !(zoneOutputs.get(zone.id) ?? []).some(
                      (o) => String(o.nodeId) === item.outputNodeId
                    )
                  "
                  class="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
                >
                  <i
                    class="icon-[lucide--image] size-6 text-warning-background/50"
                  />
                  <p class="text-xs">
                    {{ t('linearMode.arrange.resultsLabel') }}
                  </p>
                </div>
              </div>
              <!-- Input widget group (one render per node, filtered widgets) -->
              <DropZone
                v-else-if="item.type === 'input' && item.nodeData"
                :on-drag-over="item.nodeData.onDragOver"
                :on-drag-drop="item.nodeData.onDragDrop"
                :drop-indicator="item.nodeData.dropIndicator"
              >
                <NodeWidgets
                  :node-data="item.nodeData"
                  :class="
                    cn(
                      'gap-y-3 rounded-lg py-3 *:has-[textarea]:h-50 **:[.col-span-2]:grid-cols-1 not-md:**:[.h-7]:h-10',
                      item.nodeData.hasErrors &&
                        'ring-2 ring-node-stroke-error ring-inset'
                    )
                  "
                />
              </DropZone>
              <!-- Preset strip -->
              <PresetStrip
                v-else-if="item.type === 'preset-strip'"
                :display-mode="appModeStore.presetDisplayMode"
              />
              <!-- Run controls -->
              <div
                v-else-if="item.type === 'run-controls'"
                class="flex flex-col gap-2 border-t border-border-subtle pt-3"
              >
                <div class="flex w-full flex-col gap-1">
                  <span
                    class="text-xs text-muted-foreground"
                    v-text="t('linearMode.runCount')"
                  />
                  <ScrubableNumberInput
                    v-model="batchCount"
                    :aria-label="t('linearMode.runCount')"
                    :min="1"
                    :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
                    class="h-10 w-full"
                  />
                </div>
                <Button
                  v-tooltip.top="t('linearMode.arrange.shiftClickPriority')"
                  data-testid="linear-run-button"
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
          </div>
        </div>
      </template>
    </LayoutZoneGrid>
  </div>
  <ImageLightbox v-model="lightboxOpen" :src="lightboxSrc" />
</template>
