<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import LayoutZoneGrid from '@/components/builder/LayoutZoneGrid.vue'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import { getTemplate } from '@/components/builder/layoutTemplates'
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
import { useQueueSettingsStore } from '@/stores/queueStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

import { cn } from '@/utils/tailwindUtil'

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
  const zones = template.value.zones
  const inputZones = zones.filter((z) => !z.isOutput)
  return inputZones.at(-1)?.id ?? zones.at(-1)?.id ?? ''
})

/** Per-zone output results — each zone gets its own assigned outputs. */
const zoneOutputs = computed(() => {
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

/** Get ordered item keys for a zone respecting builder reorder. */
function getOrderedItems(zoneId: string) {
  const outputs = outputItemsForZone(zoneId)
  const widgets = (zoneWidgets.value.get(zoneId) ?? []).flatMap((nd) =>
    (nd.widgets ?? []).map((w) => ({
      nodeId: String(nd.id),
      widgetName: w.name
    }))
  )
  const hasRun = zoneId === runControlsZoneId.value
  return appModeStore.getZoneItems(zoneId, outputs, widgets, hasRun)
}

/** Zones that have any content (inputs, outputs, or run controls). */
const filledZones = computed(() => {
  const filled = new Set<string>()
  for (const zone of template.value.zones) {
    const hasWidgets = (zoneWidgets.value.get(zone.id)?.length ?? 0) > 0
    const hasOutputs =
      zoneOutputs.value.has(zone.id) || zoneOutputNodeCount.value.has(zone.id)
    const hasRun = zone.id === runControlsZoneId.value
    if (hasWidgets || hasOutputs || hasRun) filled.add(zone.id)
  }
  return filled
})

/** Zone IDs that appear in the bottom row of the grid template. */
const bottomRowZoneIds = computed(() => {
  const lines = template.value.gridTemplate
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'))
  if (lines.length === 0) return new Set<string>()
  const lastRow = lines[lines.length - 1]
  const match = lastRow.match(/"([^"]+)"/)
  if (!match) return new Set<string>()
  return new Set(match[1].split(/\s+/))
})

/** Border style for a zone using ring (inset, no overflow clipping). */
function zoneBorderClass(zoneId: string): string {
  if (!filledZones.value.has(zoneId)) return ''
  const isOutput =
    zoneOutputs.value.has(zoneId) || zoneOutputNodeCount.value.has(zoneId)
  const isBottom = bottomRowZoneIds.value.has(zoneId)
  if (isOutput || isBottom)
    return 'rounded-xl ring-2 ring-border-subtle ring-inset'
  return 'rounded-t-xl ring-2 ring-border-subtle ring-inset'
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
            <MediaOutputPreview
              v-for="(output, idx) in zoneOutputs.get(zone.id)"
              :key="idx"
              :output="output"
            />
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
  <div v-else class="mx-auto flex size-full max-w-[90%] flex-col py-4">
    <LayoutZoneGrid
      :template="template"
      :dashed="false"
      :grid-overrides="appModeStore.gridOverrides"
      :filled-zones="filledZones"
      class="min-h-0 overflow-visible"
    >
      <template #zone="{ zone }">
        <!-- Outer: full cell height, alignment controlled per zone -->
        <div
          :class="
            cn(
              'flex size-full min-h-0 flex-col',
              (appModeStore.zoneAlign[zone.id] ?? 'top') === 'bottom'
                ? 'justify-end'
                : 'justify-start'
            )
          "
        >
          <!-- Inner: border wraps only the content -->
          <div
            :class="
              cn(
                'flex min-h-0 flex-col gap-2 overflow-y-auto p-2',
                zoneBorderClass(zone.id),
                zoneOutputs.has(zone.id) || zoneOutputNodeCount.has(zone.id)
                  ? 'flex-1'
                  : ''
              )
            "
          >
            <!-- Unified item order — respects builder reorder -->
            <template
              v-for="itemKey in getOrderedItems(zone.id)"
              :key="itemKey"
            >
              <!-- Output node -->
              <div
                v-if="itemKey.startsWith('output:')"
                :class="
                  cn(
                    'min-h-0 flex-1 overflow-hidden rounded-lg border border-warning-background/50',
                    !(zoneOutputs.get(zone.id)?.length ?? 0) &&
                      'bg-warning-background/5 p-4'
                  )
                "
              >
                <div
                  v-if="(zoneOutputs.get(zone.id)?.length ?? 0) > 0"
                  class="flex size-full flex-col gap-2"
                >
                  <MediaOutputPreview
                    v-for="(output, idx) in zoneOutputs.get(zone.id)"
                    :key="idx"
                    :output="output"
                    class="min-h-0 flex-1"
                  />
                </div>
                <div
                  v-else
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
              <!-- Input widget group -->
              <template v-else-if="itemKey.startsWith('input:')">
                <template
                  v-for="nodeData of zoneWidgets.get(zone.id) ?? []"
                  :key="nodeData.id"
                >
                  <DropZone
                    v-if="
                      (nodeData.widgets ?? []).some(
                        (w) => itemKey === `input:${nodeData.id}:${w.name}`
                      )
                    "
                    :on-drag-over="nodeData.onDragOver"
                    :on-drag-drop="nodeData.onDragDrop"
                  >
                    <NodeWidgets
                      :node-data
                      :class="
                        cn(
                          'gap-y-3 rounded-lg py-3 *:has-[textarea]:h-50 **:[.col-span-2]:grid-cols-1 not-md:**:[.h-7]:h-10',
                          nodeData.hasErrors &&
                            'ring-2 ring-node-stroke-error ring-inset'
                        )
                      "
                    />
                  </DropZone>
                </template>
              </template>
              <!-- Run controls -->
              <div
                v-else-if="itemKey === 'run-controls'"
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
</template>
