/* oxlint-disable playwright/no-skipped-test -- tiers conditionally skip when the target backend lacks the required packs; environment gating, not a disabled test */
// Every-node coverage: the suite's core contract (mounts, survives
// save/reload, executes when self-sufficient) applied to ALL nodes a pack
// registers - not just the curated expectedNodes sentinels. Node lists come
// from the live backend, so a pack update is covered the moment it installs.
import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { RequiredSocket } from '@e2e/fixtures/customNode/autoRun'
import {
  batchAutoRunnable,
  planAutoRuns,
  SYNTH_PRODUCERS
} from '@e2e/fixtures/customNode/autoRun'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import {
  CONSOLE_ERROR_ALLOWLIST,
  isForeignExecutionNoise
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import type {
  LitegraphNodeGeometry,
  NodeGeometry,
  VueNodeGeometry
} from '@e2e/fixtures/customNode/geometry'
import {
  diffGeometry,
  GEOMETRY_UNSTABLE_NODES,
  loadPackGeometry,
  savePackGeometry
} from '@e2e/fixtures/customNode/geometry'
import {
  loadManifest,
  rendererPassesFor
} from '@e2e/fixtures/customNode/manifest'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { normalizeNodeDefs } from '@e2e/fixtures/customNode/typePairing'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog,
  drainBackendToIdle
} from '@e2e/fixtures/utils/customNodeSuite'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

const target = new LocalDesktopTarget()

// Measured optimum (deterministic across repeats, best ms/node); see PR.
const BATCH_SIZE = 24
const AUTO_RUN_BATCH = 10
// The auto-run disambiguation pass (re-run one node alone) waits longer than
// the batch does: by then we are timing a single node, so we can afford to
// distinguish "slow under load" from "genuinely hung" instead of misreading a
// slow CPU run as a regression.
const SINGLE_RERUN_TIMEOUT = 60_000
const GRID_SPACING = { x: 420, y: 360 }

// Nodes unsafe to execute on a bare backend; every entry names the mechanism.
const AUTO_RUN_EXCLUDE: Record<string, Record<string, string>> = {
  'ComfyUI-Impact-Pack': {
    ImpactRemoteBoolean:
      'remote-control widget node; its executing signal flip-flops between PASS and PARTIAL run-to-run (same class as essentials TransitionMask+)',
    ImpactRemoteInt:
      'remote-control widget node; its executing signal flip-flops between PASS and PARTIAL run-to-run (same class as ImpactRemoteBoolean)',
    ImpactSchedulerAdapter:
      'executing signal flip-flops between PASS and PARTIAL run-to-run (same class as essentials TransitionMask+)',
    ImpactQueueTriggerCountdown:
      'pack JS hooks the queue at submit time; client-side queuePrompt transiently refuses even through the retry, flip-flopping between PASS and VALIDATION_FAIL',
    ImageReceiver:
      'environment-variable execution: av.error.InvalidDataError decoding its default image on macOS, clean on Linux CI'
  },
  'rgthree-comfy': {
    'Power Primitive (rgthree)':
      'requires its pack JS to build the primitive value at queue time; raw defaults KeyError. Whether a page applies pack JS varies by serving setup, so excluded unconditionally - curated-workflow candidate',
    'Power Puter (rgthree)':
      'requires its pack JS to compile the expression at queue time; raw defaults KeyError. Excluded unconditionally - curated-workflow candidate'
  },
  'ComfyUI-KJNodes': {
    CreateMagicMask:
      'environment-variable execution: RuntimeError on the macOS CPU stack, clean on Linux CI',
    CreateVoronoiMask:
      'environment-variable execution: RuntimeError on the macOS CPU stack, clean on Linux CI',
    GenerateNoise:
      'environment-variable execution: rejected at validation locally, clean on Linux CI',
    Screencap_mss:
      'captures the screen; no X display on CI runners, real display locally',
    ImageGrabPIL: 'grabs the screen via PIL; OSError on headless CI runners',
    LoadAndResizeImage:
      'image-combo default follows input dir contents; a non-image media file (our staged video) makes PIL error - content-variable',
    PointsEditor:
      'requires its pack JS to inject the points JSON at queue time; raw defaults JSONDecodeError. Excluded unconditionally - curated-workflow candidate',
    SplineEditor:
      'requires its pack JS to inject the spline JSON at queue time; raw defaults JSONDecodeError. Excluded unconditionally - curated-workflow candidate',
    StringToFloatList:
      'requires its pack JS to normalize the list string at queue time; raw defaults ValueError. Excluded unconditionally - curated-workflow candidate'
  },
  'ComfyUI-VideoHelperSuite': {
    VHS_LoadAudioUpload:
      'environment-variable execution: upload combo state differs between hosts (clean locally, Exception on CI)',
    VHS_AudioToVHSAudio:
      'list-expanded execution emits no per-node executing event on some runs, so the executed-set signal flip-flops between PASS and PARTIAL (same class as essentials TransitionMask+)',
    VHS_BatchManager:
      'iteration-coordinator node; its executing signal flip-flops between PASS and PARTIAL run-to-run (same class as essentials TransitionMask+)',
    VHS_SelectLatest:
      'pack JS applyToGraph copies latest_file into downstream widget inputs and throws TypeError when its output feeds a pure socket (our PreviewAny sink) while the input dir has matching files - content-variable, crashes graphToPrompt; upstream-report candidate'
  },
  'was-node-suite-comfyui': {
    'BLIP Model Loader':
      'downloads BLIP weights at execution; hangs non-interruptibly without them and would pull large models on a networked runner',
    'SAM Model Loader':
      'downloads Segment Anything weights at execution; same non-interruptible download class as BLIP',
    'MiDaS Model Loader':
      'downloads MiDaS weights via torch hub at execution; same non-interruptible download class as BLIP',
    'CLIPSeg Model Loader':
      'downloads a CLIPSeg segmentation model at execution; same non-interruptible download class as BLIP',
    'CLIPSeg Batch Masking':
      'runs CLIPSeg inference, which downloads its model on first use; same network/model-dependent class as CLIPSeg Model Loader',
    'True Random.org Number Generator':
      'fetches entropy from random.org at validation/execution; network-dependent',
    'Create Video from Path':
      'invokes ffmpeg on a filesystem path; FileNotFoundError on CI runners, environment-variable',
    'Create Grid Image':
      'scans the input dir for images; ValueError when only non-image media is present - content-variable',
    'Random Number':
      'environment-variable execution: TypeError locally, clean on Linux CI',
    'Image History Loader':
      'reads WAS run history; state-dependent (KeyError on a fresh CI backend)',
    'Image Nova Filter':
      'pure-Python per-pixel loop takes minutes on a 512x512 input and does not respond to interrupt; observed jamming the queue for 20+ minutes',
    'Image Rembg (Remove Background)':
      'runs `pip install rembg` inside execute when the package is missing (WAS lazy-install); the silent network install blocks the executor non-interruptibly - observed deadlocking the queue',
    'Text Find and Replace Input':
      'infinite `while find in text` loop when find is an empty string (every empty-default run); non-interruptible pure-Python spin - upstream-report candidate',
    'Text File History Loader':
      'combo follows WAS text-file history; state-dependent (validation-fails on a fresh backend, may pass on a used one)',
    'MiDaS Depth Approximation':
      'loads MiDaS via torch.hub inside execute when no model is wired; downloads on a networked runner - same non-interruptible download class as the MiDaS loader',
    'MiDaS Mask Image':
      'loads MiDaS via torch.hub inside execute when no model is wired; downloads non-interruptibly on a networked runner (hung CI), runs clean only where the hub cache is warm',
    CLIPSEG2:
      'calls transformers from_pretrained(CIDAS/clipseg-rd64-refined) inside execute when no model is wired; downloads from HuggingFace on a networked runner - same class as BLIP/SAM',
    'Image Analyze':
      'environment-variable execution: RuntimeError on the macOS CPU stack, clean on Linux CI',
    'Image Crop Face':
      'environment-variable execution: clean on macOS, AttributeError on Linux CI (OpenCV cascade lookup differs)',
    'Text Parse A1111 Embeddings':
      'environment-variable execution: FileNotFoundError on macOS, clean on Linux CI (embeddings dir handling differs)'
  },
  'ComfyUI-Custom-Scripts': {
    'LoadText|pysssss':
      'reads a text file chosen by a state-dependent combo; flips between clean and ValueError with backend content state (same class as WAS Text File History Loader)'
  },
  ComfyUI_essentials: {
    'RemBGSession+':
      'initializes a rembg session that downloads its ONNX model at execution; hangs (non-interruptibly) on a backend without network/model access',
    'TransitionMask+':
      'list-expanded execution emits no per-node executing event on some runs, so the executed-set signal flip-flops between PASS and PARTIAL; mount/save-reload/connectivity tiers still cover it',
    'TransparentBGSession+':
      'ML-session initializer like RemBGSession+; sets up/downloads a background-removal model at execution, unstable on a bare backend',
    'LoadCLIPSegModels+':
      'downloads a CLIPSeg segmentation model at execution; network/model-dependent (same class as the excluded RemBG/TransparentBG loaders)'
  }
}

// Plain-typed widgets whose value is owned by pack JS: a programmatic write
// is legitimately rewritten, so set-and-stick does not apply. Keyed
// `NodeType.widgetName`; every entry names the mechanism.
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
  }
}

// Nodes whose serialized widgets_values legitimately change across
// serialize -> configure because pack JS owns them. The shrink check still
// applies; only the value comparison is skipped. Every entry names the
// mechanism.
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
    PointsEditor:
      'editor JSON widgets initialize their state on configure; a fresh create serializes empty strings',
    SplineEditor:
      'editor JSON widgets initialize their state on configure; a fresh create serializes empty strings',
    Ideogram4PromptBuilderKJ:
      'pack JS validates and resets its aspect/format text widgets on configure',
    ImageTransformKJ:
      'pack JS initializes its fill-options JSON widget on configure; a fresh create serializes an empty string'
  },
  'rgthree-comfy': {
    'Power Primitive (rgthree)':
      'pack JS rebuilds and normalizes its value widget on configure (a written string comes back as the typed default)'
  },
  'ComfyUI-Custom-Scripts': {
    'LoadText|pysssss':
      'file combo re-resolves against backend contents on configure; state-dependent (same class as its auto-run exclusion)'
  }
}

// Nodes whose pack JS renders custom editor/preview widgets outside the
// [data-testid="node-widget"] rows, so the DOM widget count legitimately
// undershoots the instance count. Slot fidelity still applies.
const MOUNT_WIDGET_ALLOWLIST: Record<string, Record<string, string>> = {
  'ComfyUI-KJNodes': {
    ContextWindowsVisualizerKJ:
      'visualizer widgets render as a custom canvas overlay, not node-widget rows',
    LoadAndResizeImage:
      'image preview widget renders as a custom element, not a node-widget row',
    PointsEditor:
      'points editor renders as a custom canvas overlay, not node-widget rows',
    SplineEditor:
      'spline editor renders as a custom canvas overlay, not node-widget rows'
  }
}

// The pack-attributed console-noise ledger moved to a shared fixture module
// (consoleErrorLedger.ts) so the curated run tier applies the same
// exceptions; this spec imports CONSOLE_ERROR_ALLOWLIST above.

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  await dismissTemplatesDialog(comfyPage)
})

// Leave the shared backend idle after every test so the next test's fresh
// page never connects to a still-running execution and inherits its async
// errors (see drainBackendToIdle). This is what makes the tiers order- and
// run-independent on one shared backend.
test.afterEach(async ({ comfyPage }) => {
  // The drain is a no-op when the queue is already idle, so it costs
  // ~nothing in the common path; the 10s ceiling only bounds a genuinely
  // busy backend. A backend still busy past it is wedged, and the auto-run
  // tier's 150s guard surfaces that with the restart diagnostic.
  await drainBackendToIdle(comfyPage.page, 10_000)
})

// The widgetValueStore keys state by node id and survives graph.clear(), so
// a recreated node that reuses an id inherits the previous node's same-named
// widget values (core bug, upstream-report candidate). Every in-page builder
// below restores a monotonic id base after clear() so ids are never reused
// within a page. Inlined per evaluate - page callbacks cannot share helpers.
declare global {
  interface Window {
    __cnIdBase?: number
    // Save/reload comparison rig; parked on the window so its stages can
    // run as separate evaluates with frame yields between them.
    __cnRt?: {
      problems: string[]
      snapshotAndConfigure: () => void
      compare: (label: string, strict: boolean) => void
      setAndStick: () => void
      finish: () => string[]
    }
  }
}

interface MountedShape {
  id: string
  widgetNames: string[]
  inputNames: string[]
  outputCount: number
}

// null entry = createNode failed for that type. The shape feeds the
// def-vs-instance fidelity check, which is renderer-independent.
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
        const node = window.LiteGraph!.createNode(type)
        if (!node) {
          shapes.push(null)
          continue
        }
        node.pos = [
          (index % cols) * (spacingX as number),
          Math.floor(index / cols) * (spacingY as number)
        ]
        window.app!.graph.add(node)
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

// S14 geometry capture, in the same mounted state the fidelity checks just
// validated. LiteGraph paints to a canvas, so its numbers come from the node
// model (size, drawn widget offsets, connection positions) - which is where
// the historical shrinking bugs lived. Vue numbers come from the rendered
// DOM, divided by the chunk-fit zoom so they are graph-space and invariant
// to chunk composition. Everything is relative to the node's own origin, so
// grid placement cannot leak into baselines.
function measureChunkGeometry(
  page: Page,
  ids: Array<string | null>,
  vueNodesEnabled: boolean
): Promise<Array<LitegraphNodeGeometry | VueNodeGeometry | null>> {
  return page.evaluate(
    ([chunkIds, vue]) => {
      type LgOut = {
        w: number
        h: number
        widgets: Array<{ name: string; y: number | null }>
        inputs: Array<[number, number]>
        outputs: Array<[number, number]>
      }
      type VueOut = {
        w: number
        h: number
        widgets: Array<{ dy: number; h: number }>
        slots: Array<[number, number]>
      }
      const results: Array<LgOut | VueOut | null> = []
      for (const id of chunkIds) {
        if (id === null) {
          results.push(null)
          continue
        }
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === id
        )
        if (!node) {
          results.push(null)
          continue
        }
        if (!vue) {
          const origin = [node.pos[0], node.pos[1]]
          const rel = (point: ArrayLike<number>): [number, number] => [
            point[0] - origin[0],
            point[1] - origin[1]
          ]
          results.push({
            w: node.size[0],
            h: node.size[1],
            widgets: (node.widgets ?? []).map((widget) => {
              const lastY = (widget as { last_y?: number }).last_y
              return {
                name: widget.name,
                y: typeof lastY === 'number' ? lastY : null
              }
            }),
            inputs: (node.inputs ?? []).map((_, slot) =>
              rel(node.getConnectionPos(true, slot))
            ),
            outputs: (node.outputs ?? []).map((_, slot) =>
              rel(node.getConnectionPos(false, slot))
            )
          })
          continue
        }
        const root = document.querySelector(`[data-node-id="${id}"]`)
        if (!root) {
          results.push(null)
          continue
        }
        const scale = window.app!.canvas.ds.scale
        const rootRect = root.getBoundingClientRect()
        results.push({
          w: rootRect.width / scale,
          h: rootRect.height / scale,
          widgets: Array.from(
            root.querySelectorAll('[data-testid="node-widget"]'),
            (row) => {
              const rect = row.getBoundingClientRect()
              return {
                dy: (rect.top - rootRect.top) / scale,
                h: rect.height / scale
              }
            }
          ),
          slots: Array.from(
            root.querySelectorAll('[data-testid="slot-connection-dot"]'),
            (dot) => {
              const rect = dot.getBoundingClientRect()
              return [
                (rect.left - rootRect.left) / scale,
                (rect.top - rootRect.top) / scale
              ] as [number, number]
            }
          )
        })
      }
      return results
    },
    [ids, vueNodesEnabled] as const
  )
}

// What the def promises the instance must materialize, in any renderer:
// every non-socketless declared input (as a widget or a socket - pack JS may
// legally convert between the two) and every declared output. Autogrow
// template inputs (COMFY_AUTOGROW_*) materialize either as the container or
// as their first `min` expansion slots, and renderers differ on which.
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
        // Expansion slots materialize dot-qualified: `container.slotName`.
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

async function packNodeKeys(
  page: Page,
  pack: string
): Promise<{ keys: string[]; defs: Record<string, RawNodeDef> }> {
  const defs = (await page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const keys = normalizeNodeDefs(defs)
    .filter((node) => node.pack === pack)
    .map((node) => node.type)
    .sort()
  return { keys, defs }
}

for (const entry of loadManifest()) {
  test.describe(`all nodes: ${entry.pack} @custom-nodes`, () => {
    test('every registered node mounts in both renderers', async ({
      comfyPage
    }) => {
      test.setTimeout(240_000)
      const { keys, defs } = await packNodeKeys(comfyPage.page, entry.pack)
      test.skip(
        keys.length === 0,
        `${entry.pack} not installed on this backend`
      )
      // Exact-count guard: the corpus below comes from the live backend, so
      // a pack silently registering fewer nodes (broken sub-import, a core
      // change breaking registration) would shrink coverage while every
      // remaining assertion stays green. At a fixed pin the count is
      // deterministic; a delta in either direction fails until the manifest
      // is deliberately recalibrated with the pin/core change that moved it.
      console.log(`custom-nodes count: ${entry.pack} = ${keys.length}`)
      expect(
        keys,
        `${entry.pack} registers ${keys.length} nodes but the manifest expects ${entry.expectedNodeCount} - a pack node failed to register (or the pack changed); recalibrate expectedNodeCount only with the change that moved it`
      ).toHaveLength(entry.expectedNodeCount)
      const declaredByKey = new Map(
        keys.map((key) => [key, declaredShape(defs[key])])
      )
      const ledger = entry.vueIncompatibleNodes ?? {}
      // S14: geometry accumulates across both renderer passes (LiteGraph
      // first, Vue second per rendererPassesFor), then records or compares
      // once at the end of the test.
      const geometryRecordMode = process.env.CN_GEOMETRY === 'record'
      const measuredGeometry: Record<string, NodeGeometry> = {}
      const geometryUnstable = GEOMETRY_UNSTABLE_NODES[entry.pack] ?? {}
      for (const ledgered of Object.keys(geometryUnstable))
        expect(
          keys,
          `stale GEOMETRY_UNSTABLE_NODES entry: ${ledgered} is not registered by ${entry.pack}`
        ).toContain(ledgered)
      for (const ledgered of Object.keys(ledger))
        expect(
          keys,
          `stale ledger entry: ${ledgered} is not registered by ${entry.pack}`
        ).toContain(ledgered)
      for (const ledgered of Object.keys(
        MOUNT_WIDGET_ALLOWLIST[entry.pack] ?? {}
      ))
        expect(
          keys,
          `stale MOUNT_WIDGET_ALLOWLIST entry: ${ledgered} is not registered by ${entry.pack}`
        ).toContain(ledgered)

      for (const vueNodesEnabled of rendererPassesFor(entry)) {
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        const failures: string[] = []
        const renderer = vueNodesEnabled ? 'vue' : 'litegraph'
        for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
          const chunk = keys.slice(offset, offset + BATCH_SIZE)
          const shapes = await addChunk(comfyPage.page, chunk)
          await comfyPage.nextFrame()
          const count = await comfyPage.nodeOps.getGraphNodesCount()
          if (count !== chunk.length)
            failures.push(
              `chunk@${offset}: graph has ${count} of ${chunk.length} nodes`
            )
          // Geometry rides the same mounted chunk. A null measurement means
          // the node never materialized - already red via the mount checks,
          // so geometry stays silent rather than double-reporting.
          const chunkGeometry = await measureChunkGeometry(
            comfyPage.page,
            shapes.map((shape) => shape?.id ?? null),
            vueNodesEnabled
          )
          for (const [index, measured] of chunkGeometry.entries()) {
            const key = chunk[index]
            if (measured === null || key in geometryUnstable) continue
            if (!vueNodesEnabled)
              measuredGeometry[key] = {
                litegraph: measured as LitegraphNodeGeometry
              }
            else if (measuredGeometry[key] && !(key in ledger))
              measuredGeometry[key].vue = measured as VueNodeGeometry
          }
          for (const [index, shape] of shapes.entries()) {
            const key = chunk[index]
            if (shape === null) {
              failures.push(`${key}: createNode returned null`)
              continue
            }
            // Renderer-independent fidelity: the instance must materialize
            // everything the def declares. Pack JS converting a widget to a
            // socket (or back) is legal; dropping the input entirely is not.
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
            if (shape.outputCount < declared.outputCount)
              failures.push(
                `${key}: instance has ${shape.outputCount} of ${declared.outputCount} declared outputs (${renderer})`
              )
            if (!vueNodesEnabled) continue
            if (key in ledger) continue
            const visible = await comfyPage.page
              .locator(`[data-node-id="${shape.id}"]`)
              .isVisible({ timeout: 2_000 })
              .catch(() => false)
            if (!visible) failures.push(`${key}: no Vue mount`)
          }
          // A mount with missing widgets or slots is a broken node, not a
          // pass. Extra DOM elements are tolerated; missing ones fail.
          if (vueNodesEnabled)
            failures.push(
              ...(await comfyPage.page.evaluate(
                ([chunkIds, ledgered, customWidgetNodes]) => {
                  const problems: string[] = []
                  for (const id of chunkIds) {
                    if (id === null) continue
                    const node = window.app!.graph.nodes.find(
                      (candidate) => String(candidate.id) === id
                    )
                    const root = document.querySelector(
                      `[data-node-id="${id}"]`
                    )
                    if (!node || !root || ledgered.includes(node.type!))
                      continue
                    const widgets = (
                      (node.widgets ?? []) as Array<{
                        advanced?: boolean
                        hidden?: boolean
                        name?: string
                        type?: string
                      }>
                    ).filter(
                      (widget) =>
                        !widget.advanced &&
                        !widget.hidden &&
                        widget.type !== 'converted-widget' &&
                        // Vue renders the seed-control combo inside its
                        // parent widget row, not as its own row.
                        widget.name !== 'control_after_generate'
                    ).length
                    const domWidgets = root.querySelectorAll(
                      '[data-testid="node-widget"]'
                    ).length
                    if (
                      domWidgets < widgets &&
                      !customWidgetNodes.includes(node.type!)
                    )
                      problems.push(
                        `${node.type}: Vue mounts ${domWidgets} of ${widgets} widgets`
                      )
                    const slots =
                      (node.inputs ?? []).filter(
                        (input) => !(input as { widget?: unknown }).widget
                      ).length + (node.outputs ?? []).length
                    const domSlots = root.querySelectorAll(
                      '[data-testid="slot-connection-dot"]'
                    ).length
                    if (domSlots < slots)
                      problems.push(
                        `${node.type}: Vue mounts ${domSlots} of ${slots} slots`
                      )
                  }
                  return problems
                },
                [
                  shapes.map((shape) => shape?.id ?? null),
                  Object.keys(ledger),
                  Object.keys(MOUNT_WIDGET_ALLOWLIST[entry.pack] ?? {})
                ] as const
              ))
            )
        }
        if (vueNodesEnabled && Object.keys(ledger).length > 0)
          console.log(
            `${entry.pack}: ${Object.keys(ledger).length} node(s) ledgered Vue-incompatible; Vue mount not asserted for them`
          )
        consoleErrors.stop()
        expect(
          failures,
          `VueNodes=${vueNodesEnabled}: ${JSON.stringify(failures, null, 1)}`
        ).toEqual([])
        const allowlist = CONSOLE_ERROR_ALLOWLIST[entry.pack] ?? []
        const allowed = consoleErrors.errors.filter((error) =>
          allowlist.some((rule) => rule.pattern.test(error))
        )
        if (allowed.length > 0)
          console.log(
            `${entry.pack}: ${allowed.length} console error(s) matched the pack's allowlist (${allowlist.map((rule) => rule.reason).join('; ')})`
          )
        expect(
          consoleErrors.errors.filter(
            (error) =>
              !allowlist.some((rule) => rule.pattern.test(error)) &&
              !isForeignExecutionNoise(error)
          ),
          `console errors with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
        await expectNoVisibleErrors(
          comfyPage.page,
          `after all-nodes VueNodes=${vueNodesEnabled} pass`
        )
      }
      // S14: record regenerates the baseline then fails loudly - recording
      // must be a deliberate act, never a green run that rewrote its own
      // expectations. Compare is exact: the world is pinned, so any delta
      // names a real change; a missing baseline reds rather than skips (a
      // silently uncovered pack is the failure mode this suite bans).
      if (geometryRecordMode) {
        savePackGeometry(entry.pack, {
          recordedAt: {
            core: process.env.CN_GEOMETRY_CORE ?? 'unrecorded',
            pin: entry.pin
          },
          schema: 1,
          nodes: measuredGeometry
        })
        throw new Error(
          `geometry baselines recorded for ${entry.pack} - commit browser_tests/fixtures/customNode/geometry/${entry.pack}.json and re-run without CN_GEOMETRY`
        )
      }
      const geometryBaseline = loadPackGeometry(entry.pack)
      expect(
        geometryBaseline,
        `${entry.pack} has no geometry baseline - record one (CN_GEOMETRY=record, in the CI environment for font parity) and commit it`
      ).not.toBeNull()
      expect(
        diffGeometry(geometryBaseline!.nodes, measuredGeometry),
        'node geometry deltas vs baseline'
      ).toEqual([])
    })

    test('every registered node survives save/reload', async ({
      comfyPage
    }) => {
      test.setTimeout(480_000)
      const { keys } = await packNodeKeys(comfyPage.page, entry.pack)
      test.skip(
        keys.length === 0,
        `${entry.pack} not installed on this backend`
      )

      const allowedWidgets = WIDGET_SET_ALLOWLIST[entry.pack] ?? {}
      for (const ledgered of Object.keys(allowedWidgets))
        expect(
          keys,
          `stale WIDGET_SET_ALLOWLIST entry: ${ledgered} names a node not registered by ${entry.pack}`
        ).toContain(ledgered.slice(0, ledgered.indexOf('.')))
      const allowedValueDrift = ROUNDTRIP_VALUE_ALLOWLIST[entry.pack] ?? {}
      for (const ledgered of Object.keys(allowedValueDrift))
        expect(
          keys,
          `stale ROUNDTRIP_VALUE_ALLOWLIST entry: ${ledgered} is not registered by ${entry.pack}`
        ).toContain(ledgered)
      // Widget values flow through the same store in both renderers, but
      // only the Vue pass runs component mount/configure effects that can
      // write back into that store - so the round-trip must hold under
      // both. Each stage yields a frame so those effects actually flush
      // before the next serialize (a single evaluate would serialize before
      // any Vue component reacted).
      for (const vueNodesEnabled of rendererPassesFor(entry)) {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        const consoleErrors = collectConsoleErrors(comfyPage.page)
        const mismatches: string[] = []
        for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
          const chunk = keys.slice(offset, offset + BATCH_SIZE)
          // Stage 1 - create the chunk and park the comparison rig on the
          // window; its closures carry state across the staged evaluates.
          await comfyPage.page.evaluate(
            ([types, packManaged, valueDriftNodes]) => {
              window.app!.graph.clear()
              window.app!.graph.last_node_id = window.__cnIdBase ?? 0
              const created = new Map<
                string,
                { type: string; widgetCount: number }
              >()
              for (const type of types) {
                const node = window.LiteGraph!.createNode(type)
                if (!node) continue
                window.app!.graph.add(node)
                created.set(String(node.id), {
                  type,
                  widgetCount: (node.widgets ?? []).length
                })
              }
              window.__cnIdBase = window.app!.graph.last_node_id
              const problems: string[] = []
              // Serialized widgets_values can be an array or a named object;
              // reload may legitimately APPEND entries (control_after_generate
              // materializes, packs add value-driven dynamic widgets) but must
              // never lose or change what was saved.
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
                snapshotAndConfigure() {
                  namesBefore = widgetNamesById()
                  firstPass = window.app!.graph.serialize()
                  window.app!.graph.configure(firstPass)
                },
                // strict = pristine pass: reload may add dynamic widgets but
                // must never shrink a node (the "widgets disappear after
                // save/reload" bug class) and must preserve every value. The
                // set-values pass is not strict: a changed combo/toggle
                // legitimately rebuilds a dynamic node's widget set, so
                // values are only compared where the topology stayed put.
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
                      problems.push(`${expected.type}: lost on ${label} reload`)
                      continue
                    }
                    if (after.type !== before.type)
                      problems.push(
                        `${expected.type}: type became ${String(after.type)} on ${label} reload`
                      )
                    const widgets = (restored.widgets ?? []).length
                    if (strict && widgets < expected.widgetCount)
                      problems.push(
                        `${expected.type}: widgets ${expected.widgetCount} -> ${widgets} on ${label} reload`
                      )
                    if (!strict && namesBefore.get(id) !== namesAfter.get(id))
                      continue
                    if (valueDriftNodes.includes(expected.type)) continue
                    if (!preserves(before.widgets_values, after.widgets_values))
                      problems.push(
                        `${expected.type}: widgets_values ${JSON.stringify(before.widgets_values ?? null)} -> ${JSON.stringify(after.widgets_values ?? null)} on ${label} reload`
                      )
                  }
                },
                // Set-and-stick: every plain widget must hold a programmatic
                // non-default write. Widget types owned by pack JS (editors,
                // previews, annotated controls) are skipped: their values are
                // not a user-writable contract.
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
                    // Value-drift-ledgered nodes own their values wholesale;
                    // writing probe values into them just makes pack JS choke
                    // on our markers (e.g. editors parsing `..._cn` as JSON).
                    if (valueDriftNodes.includes(nodeType)) continue
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
                        if (typeof widget.value === 'boolean')
                          return !widget.value
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
                  const out = [...problems]
                  window.app!.graph.clear()
                  return out
                }
              }
            },
            [chunk, allowedWidgets, Object.keys(allowedValueDrift)] as const
          )
          await comfyPage.nextFrame()
          // Stage 2 - pristine snapshot + reload.
          await comfyPage.page.evaluate(() =>
            window.__cnRt!.snapshotAndConfigure()
          )
          await comfyPage.nextFrame()
          // Stage 3 - pristine verdict, then write non-default values.
          await comfyPage.page.evaluate(() => {
            window.__cnRt!.compare('pristine', true)
            window.__cnRt!.setAndStick()
          })
          await comfyPage.nextFrame()
          // Stage 4 - reload again with the written values.
          await comfyPage.page.evaluate(() =>
            window.__cnRt!.snapshotAndConfigure()
          )
          await comfyPage.nextFrame()
          // Stage 5 - set-values verdict; collect and reset.
          mismatches.push(
            ...(await comfyPage.page.evaluate(() => {
              window.__cnRt!.compare('set-values', false)
              return window.__cnRt!.finish()
            }))
          )
        }
        consoleErrors.stop()
        const allowlist = CONSOLE_ERROR_ALLOWLIST[entry.pack] ?? []
        expect(
          consoleErrors.errors.filter(
            (error) =>
              !allowlist.some((rule) => rule.pattern.test(error)) &&
              !isForeignExecutionNoise(error)
          ),
          `console errors during save/reload with VueNodes=${vueNodesEnabled}`
        ).toEqual([])
        expect(
          mismatches,
          `VueNodes=${vueNodesEnabled}: ${JSON.stringify(mismatches, null, 1)}`
        ).toEqual([])
      }
      await expectNoVisibleErrors(comfyPage.page, 'after save/reload sweep')
    })

    // Runs under one renderer by design: execution is a backend contract,
    // and graphToPrompt reads widget values through the same store in both
    // renderers - Vue-specific value effects are covered by the save/reload
    // tier's Vue pass. Also deliberately NOT asserted here: zero visible
    // errors - this tier provokes real execution failures (baselined
    // cannotRunAlone nodes), and the app surfaces those as toasts/dialogs
    // by design.
    test('every auto-runnable node executes without error', async ({
      comfyPage
    }) => {
      test.setTimeout(900_000)
      const { keys, defs } = await packNodeKeys(comfyPage.page, entry.pack)
      test.skip(
        keys.length === 0,
        `${entry.pack} not installed on this backend`
      )
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)

      // A prior pack's slow CPU execution can still be draining when this tier
      // starts (all packs share one backend, locally and on CI alike; CI's
      // unloaded runner keeps executions fast, a busy local machine may not).
      // Wait it out rather than hard-fail: interrupt,
      // clear the pending queue, and poll until the backend is idle. Slow-but-
      // finite executions drain within the budget; only a truly wedged backend
      // (which the exclusions already prevent) stays busy past it. The wait is
      // free when the queue is already idle, so it costs nothing on CI.
      const queueBusy = await drainBackendToIdle(comfyPage.page, 150_000)
      expect(
        queueBusy,
        'backend still has a running prompt after a 150s drain - a genuinely wedged (non-interruptible) execution; restart the test backend'
      ).toBe(0)

      const excluded = AUTO_RUN_EXCLUDE[entry.pack] ?? {}
      for (const [key, reason] of Object.entries(excluded)) {
        expect(
          keys,
          `stale AUTO_RUN_EXCLUDE entry: ${key} is not registered by ${entry.pack}`
        ).toContain(key)
        console.log(`${entry.pack}: ${key} excluded from auto-run (${reason})`)
      }
      const verdicts = planAutoRuns(
        defs,
        keys.filter((key) => !(key in excluded))
      )
      const counts = new Map<string, number>()
      for (const verdict of verdicts)
        counts.set(verdict.verdict, (counts.get(verdict.verdict) ?? 0) + 1)
      console.log(
        `${entry.pack} auto-run plan: ${[...counts.entries()]
          .map(([verdict, count]) => `${verdict}=${count}`)
          .join(' ')}`
      )

      const batches = batchAutoRunnable(verdicts, AUTO_RUN_BATCH)
      const hardFailures: string[] = []
      const cannotRun = new Map<string, string>()
      const ranClean = new Set<string>()
      for (const batch of batches) {
        const outcome = await runBatch(comfyPage.page, batch)
        if (outcome === 'PASS') {
          for (const verdict of batch) ranClean.add(verdict.key)
          continue
        }
        // A jammed queue false-timeouts everything after it - stop here.
        if (outcome.startsWith('HUNG_BACKEND')) {
          hardFailures.push(
            `[${batch.map((verdict) => verdict.key).join(', ')}]: ${outcome} - add the offender to AUTO_RUN_EXCLUDE with its mechanism`
          )
          break
        }
        // Rerun singles so the bad node names itself, with a longer timeout
        // so a slow-under-load node is not misread as a regression.
        for (const verdict of batch) {
          const single = await runBatch(
            comfyPage.page,
            [verdict],
            SINGLE_RERUN_TIMEOUT
          )
          if (single === 'PASS') ranClean.add(verdict.key)
          else if (single.startsWith('HUNG_BACKEND')) {
            hardFailures.push(
              `${verdict.key}: ${single} - add to AUTO_RUN_EXCLUDE with its mechanism`
            )
            break
          } else cannotRun.set(verdict.key, single)
        }
      }
      // Two-way reconciliation: unlisted failure = regression; listed node
      // that runs clean (or is not auto-runnable) = stale entry.
      const baseline = new Set(entry.cannotRunAlone ?? [])
      const runnable = new Set(
        batches.flatMap((batch) => batch.map((verdict) => verdict.key))
      )
      for (const [key, detail] of cannotRun)
        if (!baseline.has(key))
          hardFailures.push(
            `${key}: ${detail} - not in cannotRunAlone; a regression, or a new baseline entry (attach the run log)`
          )
      for (const key of baseline) {
        if (ranClean.has(key))
          hardFailures.push(
            `${key}: ran clean but is listed in cannotRunAlone - remove the stale entry`
          )
        else if (!runnable.has(key))
          hardFailures.push(
            `${key}: listed in cannotRunAlone but is not auto-runnable on this backend - remove the stale entry`
          )
      }
      console.log(
        `${entry.pack} auto-ran ${ranClean.size} node(s) clean; ${cannotRun.size} cannot run alone (baseline ${baseline.size})`
      )
      expect(hardFailures, JSON.stringify(hardFailures, null, 1)).toEqual([])
    })
  })
}

async function runBatch(
  page: Page,
  batch: Array<{
    key: string
    needsPreviewSink?: boolean
    requiredSockets?: RequiredSocket[]
  }>,
  timeoutMs: number = 20_000
): Promise<string> {
  const { ids, allIds, sinkIdByKey } = await page.evaluate(
    ([nodes, producers, spacingY]) => {
      window.app!.graph.clear()
      window.app!.graph.last_node_id = window.__cnIdBase ?? 0
      const ids: string[] = []
      const allIds: string[] = []
      const sinkIdByKey: Record<string, string> = {}
      for (const [index, spec] of nodes.entries()) {
        const node = window.LiteGraph!.createNode(spec.key)
        if (!node) continue
        node.pos = [0, index * (spacingY as number)]
        window.app!.graph.add(node)
        ids.push(String(node.id))
        allIds.push(String(node.id))
        for (const [socketIndex, socket] of (
          spec.requiredSockets ?? []
        ).entries()) {
          const inputIndex = node.inputs.findIndex(
            (input) => input.name === socket.name
          )
          // Pack JS may have rebuilt the socket as widget-only; the widget
          // default then applies and no wire is needed.
          if (inputIndex < 0) continue
          const producer = producers[socket.type]
          const producerNode = window.LiteGraph!.createNode(producer.nodeType)
          if (!producerNode) continue
          producerNode.pos = [
            -420 - socketIndex * 40,
            index * (spacingY as number) + socketIndex * 90
          ]
          window.app!.graph.add(producerNode)
          allIds.push(String(producerNode.id))
          producerNode.connect(producer.outputIndex, node, inputIndex)
        }
        if (spec.needsPreviewSink) {
          const sink = window.LiteGraph!.createNode('PreviewAny')!
          sink.pos = [460, index * (spacingY as number)]
          window.app!.graph.add(sink)
          node.connect(0, sink, 0)
          sinkIdByKey[spec.key] = String(sink.id)
          allIds.push(String(sink.id))
        }
      }
      window.__cnIdBase = window.app!.graph.last_node_id
      return { ids, allIds, sinkIdByKey }
    },
    [batch, SYNTH_PRODUCERS, GRID_SPACING.y] as const
  )
  // Batch default 20s = hung; the single re-run pass raises it (see caller)
  // so a node that is merely slow under load is not misread as a regression.
  const result = await target.runWorkflow(page, {
    expectedNodeIds: ids,
    graphNodeIds: allIds,
    timeoutMs
  })
  if (result.outcome === 'TIMEOUT') {
    // A slow-but-finite CPU node (seam carving, heavy image ops) can exceed
    // the batch budget under load; give the backend time to drain before
    // calling it hung, so the caller can re-run it alone with the longer
    // single timeout. Only a truly non-interruptible execution stays busy
    // past this, and that genuinely needs a backend restart.
    if ((await drainBackendToIdle(page, 90_000)) !== 0)
      return 'HUNG_BACKEND (non-interruptible execution; backend restart required)'
  }
  if (result.outcome === 'PASS') {
    // Executing-event coverage proves the node ran; the sink payload proves
    // its output actually flowed. OUTPUT_NODE targets are their own terminus
    // and promise no ui payload, so only PreviewAny sinks are asserted.
    const silent = batch
      .filter((spec) => {
        const sinkId = sinkIdByKey[spec.key]
        return sinkId !== undefined && result.outputsByNode[sinkId] == null
      })
      .map((spec) => spec.key)
    if (silent.length > 0)
      return `NO_OUTPUT (PreviewAny sink emitted no payload for: ${silent.join(', ')})`
    return 'PASS'
  }
  if (result.outcome === 'VALIDATION_FAIL' && result.clientError)
    return `VALIDATION_FAIL (client threw: ${result.clientError.slice(0, 200)})`
  return `${result.outcome}${result.error?.nodeType ? ` (${result.error.nodeType}: ${result.error.exceptionType ?? ''})` : ''}`
}
