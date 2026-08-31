import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  isForeignExecutionNoise,
  unallowlistedErrors,
  unallowlistedGlobalExtensionErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'
import {
  expectedNodeCountFor,
  loadAllManifestPackNames,
  packIdentity
} from '@e2e/fixtures/customNode/manifest'
import {
  assertPackLedgerKeys,
  packLedgerFor
} from '@e2e/fixtures/customNode/packLedger'
import { eligibleNodeTypesForTier } from '@e2e/fixtures/customNode/tierNodeExclusions'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import {
  matchesTopologyExpectation,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  rendererLedgerFor
} from '@e2e/fixtures/customNode/valueDrift'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

const BATCH_SIZE = 24
const GRID_SPACING = { x: 420, y: 360 }

interface DuplicateWidgetExpectation {
  counts: Record<string, number>
  reason: string
  restore: string
}

const MOUNT_WIDGET_DUPLICATE_EXPECTATIONS: Record<
  string,
  Record<string, DuplicateWidgetExpectation>
> = {}

const manifestPackNames = loadAllManifestPackNames()
assertPackLedgerKeys(
  'MOUNT_WIDGET_DUPLICATE_EXPECTATIONS',
  MOUNT_WIDGET_DUPLICATE_EXPECTATIONS,
  manifestPackNames
)
assertPackLedgerKeys(
  'OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH',
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  manifestPackNames
)
assertPackLedgerKeys(
  'OUTPUT_TOPOLOGY_EXPECTATIONS_VUE',
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  manifestPackNames
)

interface MountedShape {
  id: string
  widgetNames: string[]
  inputNames: string[]
  outputCount: number
}

function vueMountProblems(
  page: Page,
  mounted: Array<{ id: string; type: string }>,
  expectedDuplicatesByNode: Record<string, DuplicateWidgetExpectation>
): Promise<string[]> {
  return page.evaluate(
    ([mountedNodes, duplicateExpectations]) => {
      const problems: string[] = []
      for (const { id, type } of mountedNodes) {
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === id
        )
        const root = document.querySelector(`[data-node-id="${id}"]`)
        if (!node) {
          problems.push(`${type}: graph node is missing`)
          continue
        }
        if (!root) {
          problems.push(`${type}: no Vue mount`)
          continue
        }
        const allWidgets = (node.widgets ?? []) as Array<{
          advanced?: boolean
          name?: string
          type?: string
          options?: {
            advanced?: boolean
            canvasOnly?: boolean
            hidden?: boolean
          }
        }>
        const convertedWidgetNames = new Set(
          allWidgets
            .filter(
              ({ type }) =>
                type === 'converted-widget' ||
                type?.startsWith('converted-widget:')
            )
            .map(({ name }) => name)
            .filter((name): name is string => !!name)
        )
        const widgets = allWidgets.filter(
          (widget) =>
            !!widget.type &&
            widget.type !== 'converted-widget' &&
            !widget.type.startsWith('converted-widget:') &&
            !widget.options?.canvasOnly &&
            !(widget.options?.advanced ?? widget.advanced) &&
            !widget.options?.hidden &&
            widget.name !== 'control_after_generate'
        )
        const domWidgets = root.querySelectorAll(
          '[data-testid="node-widget"]'
        ).length
        const expectedDuplicates = duplicateExpectations[node.type!]
        if (expectedDuplicates) {
          const widgetNameCounts: Record<string, number> = {}
          for (const widget of widgets)
            widgetNameCounts[widget.name ?? ''] =
              (widgetNameCounts[widget.name ?? ''] ?? 0) + 1
          const observedDuplicates = Object.fromEntries(
            Object.entries(widgetNameCounts)
              .filter(([, count]) => count > 1)
              .sort(([left], [right]) => left.localeCompare(right))
          )
          const expectedDuplicateCounts = Object.fromEntries(
            Object.entries(expectedDuplicates.counts).sort(([left], [right]) =>
              left.localeCompare(right)
            )
          )
          if (
            JSON.stringify(observedDuplicates) !==
            JSON.stringify(expectedDuplicateCounts)
          )
            problems.push(
              `${node.type}: duplicate widget identities ${JSON.stringify(observedDuplicates)} do not match ${JSON.stringify(expectedDuplicateCounts)}; ${expectedDuplicates.reason}; ${expectedDuplicates.restore}`
            )
          const uniqueWidgetCount = new Set(
            widgets.map((widget) => widget.name)
          ).size
          if (domWidgets !== uniqueWidgetCount)
            problems.push(
              `${node.type}: Vue mounts ${domWidgets} rows for ${uniqueWidgetCount} unique widget identities; ${expectedDuplicates.reason}; ${expectedDuplicates.restore}`
            )
        } else if (domWidgets !== widgets.length)
          problems.push(
            `${node.type}: Vue mounts ${domWidgets} of ${widgets.length} widgets`
          )
        const visibleWidgetNames = new Set(
          widgets.map((widget) => widget.name).filter(Boolean)
        )
        const expectedSlotKeys = [
          ...(node.inputs ?? []).flatMap((input, index) => {
            const { name: widgetName } =
              (input as { widget?: { name?: string } }).widget ?? {}
            return widgetName &&
              !visibleWidgetNames.has(widgetName) &&
              !visibleWidgetNames.has(input.name) &&
              !convertedWidgetNames.has(widgetName) &&
              !convertedWidgetNames.has(input.name)
              ? []
              : [`${id}-in-${index}`]
          }),
          ...(node.outputs ?? []).map((_, index) => `${id}-out-${index}`)
        ].sort()
        const mountedSlotKeys = [
          ...root.querySelectorAll<HTMLElement>('[data-slot-key]')
        ]
          .map((element) => element.dataset.slotKey)
          .filter((key): key is string => key !== undefined)
          .sort()
        if (
          JSON.stringify(mountedSlotKeys) !== JSON.stringify(expectedSlotKeys)
        )
          problems.push(
            `${node.type}: Vue slot keys ${JSON.stringify(mountedSlotKeys)} do not match ${JSON.stringify(expectedSlotKeys)}`
          )
      }
      return problems
    },
    [mounted, expectedDuplicatesByNode] as const
  )
}

function addChunk(
  page: Page,
  types: string[]
): Promise<Array<MountedShape | null>> {
  return page.evaluate(
    ([chunk, spacingX, spacingY]) => {
      window.app!.graph.clear()
      window.app!.graph.last_node_id = window.__cnIdBase ?? 0
      const cols = Math.ceil(Math.sqrt(chunk.length))
      const shapes: Array<{
        id: string
        widgetNames: string[]
        inputNames: string[]
        outputCount: number
      } | null> = []
      for (const [index, type] of chunk.entries()) {
        const node = window.LiteGraph!.createNode(type, undefined, {
          pos: [
            (index % cols) * (spacingX as number),
            Math.floor(index / cols) * (spacingY as number)
          ]
        })
        if (!node) {
          shapes.push(null)
          continue
        }
        window.app!.graph.add(node)
        if (node.flags.collapsed) node.collapse(true)
        shapes.push({
          id: String(node.id),
          widgetNames: (node.widgets ?? []).map((widget) => widget.name),
          inputNames: (node.inputs ?? []).map((input) => input.name),
          outputCount: (node.outputs ?? []).length
        })
      }
      window.__cnIdBase = window.app!.graph.last_node_id
      const canvas = window.app!.canvas
      const rect = canvas.canvas.getBoundingClientRect()
      const width = cols * (spacingX as number)
      const height = Math.ceil(chunk.length / cols) * (spacingY as number)
      const scale = Math.min(
        (rect.width / Math.max(width, 1)) * 0.9,
        (rect.height / Math.max(height, 1)) * 0.9,
        1
      )
      canvas.ds.scale = scale
      canvas.ds.offset = [60 / scale, 60 / scale]
      canvas.setDirty(true, true)
      return shapes
    },
    [types, GRID_SPACING.x, GRID_SPACING.y] as const
  )
}

function declaredShape(def: RawNodeDef): {
  inputNames: string[]
  autogrow: Array<{ container: string; expansion: string[] }>
  outputCount: number
} {
  const inputNames: string[] = []
  const autogrow: Array<{ container: string; expansion: string[] }> = []
  for (const section of [def.input?.required, def.input?.optional])
    for (const [name, spec] of Object.entries(section ?? {})) {
      const opts = (Array.isArray(spec) ? spec[1] : undefined) as
        | {
            socketless?: boolean
            template?: { names?: string[]; min?: number }
          }
        | undefined
      if (opts?.socketless) continue
      if (opts?.template) {
        autogrow.push({
          container: name,
          expansion: (opts.template.names ?? [])
            .slice(0, opts.template.min ?? 0)
            .map((slotName) => `${name}.${slotName}`)
        })
        continue
      }
      inputNames.push(name)
    }
  return { inputNames, autogrow, outputCount: (def.output ?? []).length }
}

export async function assertMountTier({
  comfyPage,
  entry,
  defs,
  registeredKeys,
  installedManifestPacks,
  tier
}: {
  comfyPage: ComfyPage
  entry: CoreManifestEntry | CloudManifestEntry
  defs: Record<string, RawNodeDef>
  registeredKeys: string[]
  installedManifestPacks: string[]
  tier: 'S1' | 'S2'
}): Promise<void> {
  console.warn(`custom-nodes count: ${entry.pack} = ${registeredKeys.length}`)
  expect(
    registeredKeys,
    `${entry.pack} registers ${registeredKeys.length} nodes but ${expectedNodeCountFor(entry)} are expected on this backend - a pack node failed to register (or the pack changed); recalibrate only with the change that moved it`
  ).toHaveLength(expectedNodeCountFor(entry))
  const keys = eligibleNodeTypesForTier(
    { identity: packIdentity(entry), pack: entry.pack },
    tier,
    registeredKeys
  )
  const declaredByKey = new Map(
    keys.map((key) => [key, declaredShape(defs[key])])
  )
  const duplicateWidgetExpectations = packLedgerFor(
    MOUNT_WIDGET_DUPLICATE_EXPECTATIONS,
    entry.pack
  )
  for (const ledgered of Object.keys(duplicateWidgetExpectations))
    expect(
      keys,
      `stale MOUNT_WIDGET_DUPLICATE_EXPECTATIONS entry: ${ledgered} is not registered by ${entry.pack}`
    ).toContain(ledgered)

  const rendererPasses = [tier === 'S2']
  for (const vueNodesEnabled of rendererPasses) {
    const outputTopologyExpectations = packLedgerFor(
      rendererLedgerFor(
        vueNodesEnabled,
        OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
        OUTPUT_TOPOLOGY_EXPECTATIONS_VUE
      ),
      entry.pack
    )
    const observedOutputTopologies = new Set<string>()
    for (const ledgered of Object.keys(outputTopologyExpectations))
      expect(
        keys,
        `stale OUTPUT_TOPOLOGY_EXPECTATIONS entry: ${ledgered} is not registered by ${entry.pack}`
      ).toContain(ledgered)
    using consoleErrors = collectConsoleErrors(comfyPage.page)
    const failures: string[] = []
    const renderer = vueNodesEnabled ? 'vue' : 'litegraph'
    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.Enabled',
      vueNodesEnabled
    )
    for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
      const chunk = keys.slice(offset, offset + BATCH_SIZE)
      const shapes = await addChunk(comfyPage.page, chunk)
      await comfyPage.nextFrame()
      const count = await comfyPage.nodeOps.getGraphNodesCount()
      if (count !== chunk.length)
        failures.push(
          `chunk@${offset}: graph has ${count} of ${chunk.length} nodes`
        )
      for (const [index, shape] of shapes.entries()) {
        const key = chunk[index]
        if (shape === null) {
          failures.push(`${key}: createNode returned null`)
          continue
        }
        const declared = declaredByKey.get(key)!
        const present = new Set([...shape.widgetNames, ...shape.inputNames])
        for (const name of declared.inputNames)
          if (!present.has(name))
            failures.push(
              `${key}: instance is missing declared input "${name}" (${renderer})`
            )
        for (const { container, expansion } of declared.autogrow)
          if (
            !present.has(container) &&
            !expansion.every((name) => present.has(name))
          )
            failures.push(
              `${key}: autogrow input "${container}" materialized neither its container nor its first ${expansion.length} slot(s) (${renderer})`
            )
        if (shape.outputCount < declared.outputCount) {
          if (
            matchesTopologyExpectation(
              outputTopologyExpectations[key],
              declared.outputCount,
              shape.outputCount
            )
          )
            observedOutputTopologies.add(key)
          else
            failures.push(
              `${key}: instance has ${shape.outputCount} of ${declared.outputCount} declared outputs (${renderer})`
            )
        }
      }
      if (vueNodesEnabled)
        await expect
          .poll(
            () =>
              vueMountProblems(
                comfyPage.page,
                shapes.flatMap((shape, index) =>
                  shape === null ? [] : [{ id: shape.id, type: chunk[index] }]
                ),
                duplicateWidgetExpectations
              ),
            { timeout: 10_000 }
          )
          .toEqual([])
    }
    expect(
      failures,
      `VueNodes=${vueNodesEnabled}: ${JSON.stringify(failures, null, 1)}`
    ).toEqual([])
    for (const ledgered of Object.keys(outputTopologyExpectations))
      expect(
        [...observedOutputTopologies],
        `stale OUTPUT_TOPOLOGY_EXPECTATIONS entry: ${ledgered} no longer has its exact declared-to-instance output topology with VueNodes=${vueNodesEnabled}`
      ).toContain(ledgered)
    const unallowlisted = unallowlistedGlobalExtensionErrorsForPacks(
      installedManifestPacks,
      unallowlistedErrors(entry.pack, consoleErrors.errors)
    )
    const allowed = consoleErrors.errors.filter(
      (error) => !unallowlisted.includes(error)
    )
    if (allowed.length > 0)
      console.warn(
        `${entry.pack}: ${allowed.length} console error(s) matched a pack-scoped extension allowlist`
      )
    expect(
      unallowlisted.filter((error) => !isForeignExecutionNoise(error)),
      `console errors with VueNodes=${vueNodesEnabled}`
    ).toEqual([])
    await expectNoVisibleErrors(
      comfyPage.page,
      `after all-nodes VueNodes=${vueNodesEnabled} pass`
    )
  }
}
