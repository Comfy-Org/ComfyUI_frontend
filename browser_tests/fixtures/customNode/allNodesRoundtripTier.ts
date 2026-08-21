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
  loadAllManifestPackNames,
  packIdentity
} from '@e2e/fixtures/customNode/manifest'
import {
  assertPackLedgerKeys,
  packLedgerFor
} from '@e2e/fixtures/customNode/packLedger'
import { eligibleNodeTypesForTier } from '@e2e/fixtures/customNode/tierNodeExclusions'
import {
  CANVAS_PREVIEW_IMAGE_PATH_PATTERN,
  initializationSignalsForTypes,
  pendingRestoredPreviewWidgets,
  pendingRoundtripInitializations,
  rendererLedgerFor,
  ROUNDTRIP_INITIALIZATION_SIGNALS,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE,
  ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE,
  staleValueDriftIndices,
  staleValueDriftKeys
} from '@e2e/fixtures/customNode/valueDrift'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

const BATCH_SIZE = 24
const ROUNDTRIP_INITIALIZATION_TIMEOUT_MS = 30_000

const WIDGET_SET_ALLOWLIST: Record<string, Record<string, string>> = {
  'ComfyUI-Impact-Pack': {
    'BasicPipeToDetailerPipe.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'BasicPipeToDetailerPipeSDXL.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'ImpactWildcardEncode.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard to the text widget and resets the combo to its label',
    'ImpactWildcardProcessor.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'ToDetailerPipe.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'ToDetailerPipeSDXL.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'EditDetailerPipe.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'EditDetailerPipeSDXL.Select to add Wildcard':
      'menu-action combo: pack JS applies the chosen wildcard and resets the combo to its label',
    'PreviewBridge.image':
      'pack JS canonicalizes the value to its internal $nodeId-slot reference on every write',
    'PreviewBridgeLatent.image':
      'pack JS canonicalizes the value to its internal $nodeId-slot reference on every write'
  },
  'ComfyUI-KJNodes': {
    'Ideogram4PromptBuilderKJ.style_palette_data':
      'hidden serialized palette owned by the Ideogram editor',
    'Ideogram4PromptBuilderKJ.elements_data':
      'hidden serialized regions owned by the Ideogram editor',
    'Ideogram4PromptBuilderKJ.bg_brightness':
      'hidden value owned by the Ideogram editor slider',
    'Ideogram4PromptBuilderKJ.output_format':
      'hidden value owned by the Ideogram editor output menu',
    'Ideogram4PromptBuilderKJ.coord_mode':
      'hidden value owned by the Ideogram editor output menu',
    'Ideogram4PromptBuilderKJ.bbox_order':
      'hidden value owned by the Ideogram editor output menu',
    'ImageTransformKJ.bboxes':
      'serialized crop state owned by the image-transform editor',
    'PointsEditor.points_store':
      'serialized point state owned by the points editor',
    'PointsEditor.coordinates':
      'derived coordinates owned by the points editor',
    'PointsEditor.neg_coordinates':
      'derived negative coordinates owned by the points editor',
    'PointsEditor.bbox_store':
      'serialized bounding boxes owned by the points editor',
    'PointsEditor.bboxes': 'derived bounding boxes owned by the points editor',
    'SplineEditor.points_store':
      'serialized path state owned by the spline editor',
    'SplineEditor.coordinates':
      'derived sampled coordinates owned by the spline editor'
  },
  'ComfyUI-LTXVideo': {
    'LTXVSparseTrackEditor.points_store':
      'serialized track state owned by the sparse-track editor',
    'LTXVSparseTrackEditor.coordinates':
      'derived coordinates owned by the sparse-track editor'
  }
}

const ROUNDTRIP_VALUE_ALLOWLIST: Record<string, Record<string, string>> = {
  'ComfyUI-VideoHelperSuite': {
    VHS_LoadVideo:
      'upload-button widget serializes a placeholder value fresh but is rebuilt valueless by pack JS on configure',
    VHS_LoadVideoFFmpeg:
      'upload-button widget serializes a placeholder value fresh but is rebuilt valueless by pack JS on configure',
    VHS_LoadImages:
      'upload-button widget serializes a placeholder value fresh but is rebuilt valueless by pack JS on configure',
    VHS_LoadAudioUpload:
      'upload-button widget serializes a placeholder value fresh but is rebuilt valueless by pack JS on configure',
    VHS_VAEDecodeBatched:
      'per_batch serializes null after configure (VHS ANNOTATED widget deserialization gap) - upstream-report candidate',
    VHS_VAEEncodeBatched:
      'per_batch serializes null after configure (VHS ANNOTATED widget deserialization gap) - upstream-report candidate'
  },
  'ComfyUI-KJNodes': {
    SplineEditor:
      'the spline editor regenerates its derived sampled coordinates from the preserved source points on configure'
  },
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor:
      'the sparse-track editor regenerates its derived integer coordinates from the preserved source points on configure'
  },
  'ComfyUI_Fill-Nodes': {
    FL_ColorPicker:
      'color widget canonicalizes the probe color and derived RGB channels on configure',
    FL_ReplaceColor:
      'color widgets canonicalize the probe colors and derived RGB channels on configure'
  },
  'WhatDreamsCost-ComfyUI': {
    LoadAudioUI:
      'custom audio UI clamps end and duration to the loaded file duration and normalizes absent player state on configure',
    LTXDirector:
      'director UI canonicalizes timeline JSON and its derived prompt fields on configure'
  },
  'comfyui-itools': {
    iToolsRegexNode:
      'pattern-picker reload replaces the regex field with the selected built-in pattern'
  }
}

const manifestPackNames = loadAllManifestPackNames()
assertPackLedgerKeys(
  'ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH',
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE',
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_INITIALIZATION_SIGNALS',
  ROUNDTRIP_INITIALIZATION_SIGNALS,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_VALUE_ALLOWLIST',
  ROUNDTRIP_VALUE_ALLOWLIST,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH',
  ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE',
  ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH',
  ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH,
  manifestPackNames
)
assertPackLedgerKeys(
  'ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE',
  ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE,
  manifestPackNames
)
assertPackLedgerKeys(
  'WIDGET_SET_ALLOWLIST',
  WIDGET_SET_ALLOWLIST,
  manifestPackNames
)

declare global {
  interface Window {
    __cnIdBase?: number
    __cnRt?: {
      problems: string[]
      captureInitialWidgetCounts: () => void
      previewWidgetState: () => {
        requiredByNode: Record<string, string[]>
        observedByNode: Record<string, string[]>
      }
      snapshotAndConfigure: () => void
      compare: (label: string, strict: boolean) => void
      setAndStick: () => void
      finish: () => {
        problems: string[]
        nodeLosses: string[]
        topologyDrifts: Array<{
          node: string
          before: number
          after: number
          beforeNames: string
          afterNames: string
          label: string
        }>
        valueDrifts: Record<string, number[]>
        keyDrifts: Record<string, string[]>
      }
    }
  }
}

export async function assertRoundtripTier({
  comfyPage,
  entry,
  registeredKeys,
  installedManifestPacks
}: {
  comfyPage: ComfyPage
  entry: CoreManifestEntry | CloudManifestEntry
  registeredKeys: string[]
  installedManifestPacks: string[]
}): Promise<void> {
  const keys = eligibleNodeTypesForTier(
    { identity: packIdentity(entry), pack: entry.pack },
    'S3',
    registeredKeys
  )
  const allowedWidgets = packLedgerFor(WIDGET_SET_ALLOWLIST, entry.pack)
  for (const ledgered of Object.keys(allowedWidgets))
    expect(
      keys,
      `stale WIDGET_SET_ALLOWLIST entry: ${ledgered} names a node not registered by ${entry.pack}`
    ).toContain(ledgered.slice(0, ledgered.indexOf('.')))
  const allowedValueDrift = packLedgerFor(ROUNDTRIP_VALUE_ALLOWLIST, entry.pack)
  for (const ledgered of Object.keys(allowedValueDrift))
    expect(
      keys,
      `stale ROUNDTRIP_VALUE_ALLOWLIST entry: ${ledgered} is not registered by ${entry.pack}`
    ).toContain(ledgered)
  const exactValueDriftNodes = new Set(
    [
      packLedgerFor(ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH, entry.pack),
      packLedgerFor(ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE, entry.pack),
      packLedgerFor(ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH, entry.pack),
      packLedgerFor(ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE, entry.pack)
    ].flatMap((ledger) => Object.keys(ledger))
  )
  const initializationSignals = packLedgerFor(
    ROUNDTRIP_INITIALIZATION_SIGNALS,
    entry.pack
  )
  for (const node of Object.keys(initializationSignals))
    expect(
      keys,
      `stale ROUNDTRIP_INITIALIZATION_SIGNALS entry: ${node} is not registered by ${entry.pack}`
    ).toContain(node)
  for (const ledgered of exactValueDriftNodes)
    expect(
      allowedValueDrift,
      `exact roundtrip value entry ${ledgered} has no matching mechanism in ROUNDTRIP_VALUE_ALLOWLIST`
    ).toHaveProperty(ledgered)
  for (const ledgered of Object.keys(allowedValueDrift))
    expect(
      [...exactValueDriftNodes],
      `ROUNDTRIP_VALUE_ALLOWLIST entry ${ledgered} has no exact renderer contract`
    ).toContain(ledgered)
  const roundtripRenderers = [false, true]
  const rendererMismatches: string[] = []
  for (const vueNodesEnabled of roundtripRenderers) {
    const rawValueIndices = packLedgerFor(
      rendererLedgerFor(
        vueNodesEnabled,
        ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
        ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE
      ),
      entry.pack
    )
    const allowedValueIndices = Object.fromEntries(
      Object.keys(rawValueIndices).map((node) => [
        node,
        rawValueIndices[node].split(',').map(Number)
      ])
    )
    const rawValueKeys = packLedgerFor(
      rendererLedgerFor(
        vueNodesEnabled,
        ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH,
        ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE
      ),
      entry.pack
    )
    const allowedValueKeys = Object.fromEntries(
      Object.keys(rawValueKeys).map((node) => [
        node,
        rawValueKeys[node].split(',')
      ])
    )
    const observedValueDrift = new Map<string, Set<number>>()
    const observedKeyDrift = new Map<string, Set<string>>()
    const expectedNodeLosses = packLedgerFor(
      rendererLedgerFor(
        vueNodesEnabled,
        ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH,
        ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE
      ),
      entry.pack
    )
    const observedNodeLosses = new Set<string>()
    for (const ledgered of Object.keys(expectedNodeLosses))
      expect(
        keys,
        `stale ROUNDTRIP_NODE_LOSS_EXPECTATIONS entry: ${ledgered} is not registered by ${entry.pack}`
      ).toContain(ledgered)
    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.Enabled',
      vueNodesEnabled
    )
    const consoleErrors = collectConsoleErrors(comfyPage.page)
    const mismatches: string[] = []
    for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
      const chunk = keys.slice(offset, offset + BATCH_SIZE)
      const chunkInitializationSignals = initializationSignalsForTypes(
        initializationSignals,
        chunk
      )
      await comfyPage.page.evaluate(
        ([
          types,
          packManaged,
          exactValueDriftIndices,
          exactValueDriftKeys,
          allowedNodeLosses,
          vueNodesEnabled,
          canvasPreviewImagePathPattern
        ]) => {
          window.app!.graph.clear()
          window.app!.graph.last_node_id = window.__cnIdBase ?? 0
          const created = new Map<
            string,
            {
              type: string
              widgetCount: number | null
              previewWidgetNames: string[]
            }
          >()
          const acceptedImagePathPattern = new RegExp(
            canvasPreviewImagePathPattern.source,
            canvasPreviewImagePathPattern.flags
          )
          for (const type of types) {
            const node = window.LiteGraph!.createNode(type)
            if (!node) continue
            window.app!.graph.add(node)
            const widgets = node.widgets ?? []
            const uploadWidget = widgets.find(
              (widget) => widget.type === 'button' && widget.name === 'upload'
            )
            const imageWidget = widgets.find(
              (widget) => widget.name === uploadWidget?.value
            )
            const expectsCanvasPreview =
              !vueNodesEnabled &&
              node.previewMediaType === 'image' &&
              acceptedImagePathPattern.test(String(imageWidget?.value))
            created.set(String(node.id), {
              type,
              widgetCount: null,
              previewWidgetNames: expectsCanvasPreview
                ? ['$$canvas-image-preview']
                : []
            })
          }
          window.__cnIdBase = window.app!.graph.last_node_id
          const problems: string[] = []
          const topologyDrifts: Array<{
            node: string
            before: number
            after: number
            beforeNames: string
            afterNames: string
            label: string
          }> = []
          const valueDrifts = new Map<string, Set<number>>()
          const keyDrifts = new Map<string, Set<string>>()
          const nodeLosses = new Set<string>()
          const preserves = (before: unknown, after: unknown): boolean => {
            const beforeNormalized =
              Array.isArray(before) && before.length === 0 ? null : before
            const afterNormalized =
              Array.isArray(after) && after.length === 0 ? null : after
            if (beforeNormalized === null) return true
            if (Array.isArray(beforeNormalized))
              return (
                Array.isArray(afterNormalized) &&
                afterNormalized.length >= beforeNormalized.length &&
                beforeNormalized.every(
                  (value, index) =>
                    JSON.stringify(value) ===
                    JSON.stringify(afterNormalized[index])
                )
              )
            if (typeof beforeNormalized === 'object')
              return (
                typeof afterNormalized === 'object' &&
                afterNormalized !== null &&
                Object.entries(beforeNormalized).every(
                  ([key, value]) =>
                    JSON.stringify(value) ===
                    JSON.stringify(
                      (afterNormalized as Record<string, unknown>)[key]
                    )
                )
              )
            return (
              JSON.stringify(beforeNormalized) ===
              JSON.stringify(afterNormalized)
            )
          }
          const widgetNamesById = () =>
            new Map(
              window.app!.graph.nodes.map((node) => [
                String(node.id),
                (node.widgets ?? []).map((widget) => widget.name).join(',')
              ])
            )
          let namesBefore = new Map<string, string>()
          let firstPass: ReturnType<
            NonNullable<typeof window.app>['graph']['serialize']
          > | null = null
          window.__cnRt = {
            problems,
            captureInitialWidgetCounts() {
              for (const node of window.app!.graph.nodes) {
                const expected = created.get(String(node.id))
                if (expected) expected.widgetCount = (node.widgets ?? []).length
              }
            },
            previewWidgetState() {
              const requiredByNode: Record<string, string[]> = {}
              const observedByNode: Record<string, string[]> = {}
              for (const [id, expected] of created) {
                if (expected.previewWidgetNames.length === 0) continue
                requiredByNode[expected.type] = expected.previewWidgetNames
                const node = window.app!.graph.nodes.find(
                  (candidate) => String(candidate.id) === id
                )
                observedByNode[expected.type] = (node?.widgets ?? []).map(
                  (widget) => widget.name
                )
              }
              return { requiredByNode, observedByNode }
            },
            snapshotAndConfigure() {
              namesBefore = widgetNamesById()
              firstPass = window.app!.graph.serialize()
              window.app!.graph.configure(firstPass)
            },
            compare(label: string, strict: boolean) {
              const secondPass = window.app!.graph.serialize()
              const namesAfter = widgetNamesById()
              const byId = (pass: NonNullable<typeof firstPass>) =>
                new Map(
                  (pass.nodes ?? []).map((node) => [String(node.id), node])
                )
              const beforeNodes = byId(firstPass!)
              const afterNodes = byId(secondPass)
              for (const [id, expected] of created) {
                const before = beforeNodes.get(id)
                const after = afterNodes.get(id)
                const restored = window.app!.graph.nodes.find(
                  (node) => String(node.id) === id
                )
                if (!before || !after || !restored) {
                  if (allowedNodeLosses.includes(expected.type))
                    nodeLosses.add(expected.type)
                  else
                    problems.push(`${expected.type}: lost on ${label} reload`)
                  continue
                }
                if (after.type !== before.type)
                  problems.push(
                    `${expected.type}: type became ${String(after.type)} on ${label} reload`
                  )
                const widgets = (restored.widgets ?? []).length
                if (expected.widgetCount === null) {
                  problems.push(
                    `${expected.type}: initial widget topology was not captured`
                  )
                  continue
                }
                const topologyShrank = widgets < expected.widgetCount
                if (strict && topologyShrank)
                  topologyDrifts.push({
                    node: expected.type,
                    before: expected.widgetCount,
                    after: widgets,
                    beforeNames: namesBefore.get(id) ?? '',
                    afterNames: namesAfter.get(id) ?? '',
                    label
                  })
                if (!strict && namesBefore.get(id) !== namesAfter.get(id))
                  topologyDrifts.push({
                    node: expected.type,
                    before: expected.widgetCount,
                    after: widgets,
                    beforeNames: namesBefore.get(id) ?? '',
                    afterNames: namesAfter.get(id) ?? '',
                    label
                  })
                const allowedIndices = exactValueDriftIndices[expected.type]
                if (
                  allowedIndices &&
                  Array.isArray(before.widgets_values) &&
                  Array.isArray(after.widgets_values) &&
                  after.widgets_values.length >= before.widgets_values.length
                ) {
                  const changed = before.widgets_values.flatMap(
                    (value, index) =>
                      JSON.stringify(value) ===
                      JSON.stringify(after.widgets_values?.[index])
                        ? []
                        : [index]
                  )
                  for (const index of changed)
                    if (allowedIndices.includes(index)) {
                      const observed =
                        valueDrifts.get(expected.type) ?? new Set<number>()
                      observed.add(index)
                      valueDrifts.set(expected.type, observed)
                    }
                  if (changed.every((index) => allowedIndices.includes(index)))
                    continue
                }
                const allowedKeys = exactValueDriftKeys[expected.type]
                const beforeWidgetValues: unknown = before.widgets_values
                const afterWidgetValues: unknown = after.widgets_values
                if (
                  allowedKeys &&
                  typeof beforeWidgetValues === 'object' &&
                  beforeWidgetValues !== null &&
                  !Array.isArray(beforeWidgetValues) &&
                  typeof afterWidgetValues === 'object' &&
                  afterWidgetValues !== null &&
                  !Array.isArray(afterWidgetValues)
                ) {
                  const changed = Object.entries(beforeWidgetValues).flatMap(
                    ([key, value]) =>
                      JSON.stringify(value) ===
                      JSON.stringify(
                        (afterWidgetValues as Record<string, unknown>)[key]
                      )
                        ? []
                        : [key]
                  )
                  for (const key of changed)
                    if (allowedKeys.includes(key)) {
                      const observed =
                        keyDrifts.get(expected.type) ?? new Set<string>()
                      observed.add(key)
                      keyDrifts.set(expected.type, observed)
                    }
                  if (changed.every((key) => allowedKeys.includes(key)))
                    continue
                }
                if (!preserves(before.widgets_values, after.widgets_values))
                  problems.push(
                    `${expected.type}: widgets_values ${JSON.stringify(before.widgets_values ?? null)} -> ${JSON.stringify(after.widgets_values ?? null)} on ${label} reload`
                  )
              }
            },
            setAndStick() {
              const SETTABLE = new Set([
                'number',
                'slider',
                'toggle',
                'text',
                'string',
                'customtext',
                'combo'
              ])
              for (const node of window.app!.graph.nodes) {
                const nodeType = created.get(String(node.id))?.type
                if (!nodeType) continue
                for (const widget of node.widgets ?? []) {
                  if (!SETTABLE.has(String(widget.type))) continue
                  if (`${nodeType}.${widget.name}` in packManaged) continue
                  const target = ((): unknown => {
                    const options = (
                      widget as {
                        options?: {
                          values?: unknown
                          min?: number
                          max?: number
                          step2?: number
                        }
                      }
                    ).options
                    if (typeof widget.value === 'boolean') return !widget.value
                    if (typeof widget.value === 'number') {
                      const step = options?.step2 || 1
                      const up = widget.value + step
                      if (options?.max === undefined || up <= options.max)
                        return up
                      const down = widget.value - step
                      if (options?.min === undefined || down >= options.min)
                        return down
                      return undefined
                    }
                    if (typeof widget.value === 'string') {
                      if (widget.type === 'combo')
                        return Array.isArray(options?.values)
                          ? options.values.find(
                              (option: unknown) => option !== widget.value
                            )
                          : undefined
                      return `${widget.value}_cn`
                    }
                    return undefined
                  })()
                  if (target === undefined || target === null) continue
                  widget.value = target as typeof widget.value
                  if (widget.value !== target)
                    problems.push(
                      `${nodeType}.${widget.name}: set ${JSON.stringify(target)} but widget kept ${JSON.stringify(widget.value)}`
                    )
                }
              }
            },
            finish() {
              const out = {
                problems: [...problems],
                nodeLosses: [...nodeLosses],
                topologyDrifts,
                valueDrifts: Object.fromEntries(
                  [...valueDrifts].map(([node, indices]) => [
                    node,
                    [...indices]
                  ])
                ),
                keyDrifts: Object.fromEntries(
                  [...keyDrifts].map(([node, keys]) => [node, [...keys]])
                )
              }
              window.app!.graph.clear()
              return out
            }
          }
        },
        [
          chunk,
          allowedWidgets,
          allowedValueIndices,
          allowedValueKeys,
          Object.keys(expectedNodeLosses),
          vueNodesEnabled,
          {
            source: CANVAS_PREVIEW_IMAGE_PATH_PATTERN.source,
            flags: CANVAS_PREVIEW_IMAGE_PATH_PATTERN.flags
          }
        ] as const
      )
      await comfyPage.nextFrame()
      const waitForInitialization = async () => {
        await expect
          .poll(
            async () => {
              const values = await comfyPage.page.evaluate((signals) => {
                const values: Record<string, unknown> = {}
                for (const [type, signal] of Object.entries(signals)) {
                  const node = window.app!.graph.nodes.find(
                    (candidate) => candidate.type === type
                  ) as unknown as Record<string, unknown> | undefined
                  if (
                    signal.predicate === 'widget-count' ||
                    signal.predicate === 'minimum-widget-count'
                  ) {
                    const widgets = (
                      node as unknown as
                        | {
                            widgets?: unknown[]
                          }
                        | undefined
                    )?.widgets
                    values[type] = (widgets ?? []).length
                  } else if (signal.predicate === 'widget-value') {
                    const widgets = (
                      node as unknown as
                        | {
                            widgets?: Array<{
                              name: string
                              value: unknown
                            }>
                          }
                        | undefined
                    )?.widgets
                    values[type] = widgets?.find(
                      (widget) => widget.name === signal.widget
                    )?.value
                  } else {
                    values[type] = node?.[signal.property]
                  }
                }
                return values
              }, chunkInitializationSignals)
              const pendingInitialization = pendingRoundtripInitializations(
                chunkInitializationSignals,
                values,
                vueNodesEnabled
              )
              const previewWidgetState = await comfyPage.page.evaluate(() =>
                window.__cnRt!.previewWidgetState()
              )
              return [
                ...pendingInitialization,
                ...pendingRestoredPreviewWidgets(
                  previewWidgetState.requiredByNode,
                  previewWidgetState.observedByNode
                )
              ]
            },
            { timeout: ROUNDTRIP_INITIALIZATION_TIMEOUT_MS }
          )
          .toEqual([])
      }
      await waitForInitialization()
      await comfyPage.page.evaluate(() =>
        window.__cnRt!.captureInitialWidgetCounts()
      )
      await comfyPage.page.evaluate(() => window.__cnRt!.snapshotAndConfigure())
      await comfyPage.nextFrame()
      await waitForInitialization()
      await comfyPage.page.evaluate(() => {
        window.__cnRt!.compare('pristine', true)
        window.__cnRt!.setAndStick()
      })
      await comfyPage.nextFrame()
      await comfyPage.page.evaluate(() => window.__cnRt!.snapshotAndConfigure())
      await comfyPage.nextFrame()
      await waitForInitialization()
      const result = await comfyPage.page.evaluate(() => {
        window.__cnRt!.compare('set-values', false)
        return window.__cnRt!.finish()
      })
      mismatches.push(...result.problems)
      for (const node of result.nodeLosses) observedNodeLosses.add(node)
      for (const drift of result.topologyDrifts) {
        mismatches.push(
          `${drift.node}: widgets ${drift.before} [${drift.beforeNames}] -> ${drift.after} [${drift.afterNames}] on ${drift.label} reload`
        )
      }
      for (const [node, indices] of Object.entries(result.valueDrifts)) {
        const observed = observedValueDrift.get(node) ?? new Set<number>()
        for (const index of indices) observed.add(index)
        observedValueDrift.set(node, observed)
      }
      for (const [node, keys] of Object.entries(result.keyDrifts)) {
        const observed = observedKeyDrift.get(node) ?? new Set<string>()
        for (const key of keys) observed.add(key)
        observedKeyDrift.set(node, observed)
      }
    }
    consoleErrors.stop()
    expect(
      unallowlistedGlobalExtensionErrorsForPacks(
        installedManifestPacks,
        unallowlistedErrors(entry.pack, consoleErrors.errors)
      ).filter((error) => !isForeignExecutionNoise(error)),
      `console errors during save/reload with VueNodes=${vueNodesEnabled}`
    ).toEqual([])
    rendererMismatches.push(
      ...mismatches.map(
        (mismatch) => `VueNodes=${vueNodesEnabled}: ${mismatch}`
      )
    )
    for (const ledgered of Object.keys(expectedNodeLosses))
      expect(
        [...observedNodeLosses],
        `stale ROUNDTRIP_NODE_LOSS_EXPECTATIONS entry: ${ledgered} now survives save/reload with VueNodes=${vueNodesEnabled}`
      ).toContain(ledgered)
    const staleValueIndices = staleValueDriftIndices(
      allowedValueIndices,
      Object.fromEntries(
        [...observedValueDrift].map(([node, indices]) => [node, [...indices]])
      )
    )
    expect(
      staleValueIndices,
      `stale ROUNDTRIP_VALUE_ALLOWED_INDICES entries with VueNodes=${vueNodesEnabled}: ${staleValueIndices.join(', ')}`
    ).toEqual([])
    const staleValueKeys = staleValueDriftKeys(
      allowedValueKeys,
      Object.fromEntries(
        [...observedKeyDrift].map(([node, keys]) => [node, [...keys]])
      )
    )
    expect(
      staleValueKeys,
      `stale ROUNDTRIP_VALUE_ALLOWED_KEYS entries with VueNodes=${vueNodesEnabled}: ${staleValueKeys.join(', ')}`
    ).toEqual([])
  }
  expect(rendererMismatches).toEqual([])
  await expectNoVisibleErrors(comfyPage.page, 'after save/reload sweep')
}
