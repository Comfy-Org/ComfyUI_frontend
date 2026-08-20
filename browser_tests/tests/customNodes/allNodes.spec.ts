// Every-node coverage: the suite's core contract (mounts, survives
// save/reload, calibrated model-free execution) applied to ALL eligible nodes a pack
// registers - not just the curated expectedNodes sentinels. Node lists come
// from the live backend, so a pack update is covered the moment it installs.
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { RequiredSocket } from '@e2e/fixtures/customNode/autoRun'
import {
  AUTO_RUN_WIDGET_INPUTS,
  batchAutoRunnable,
  CLOUD_RUN_EXCLUSIONS,
  planAutoRuns,
  SYNTH_PRODUCERS
} from '@e2e/fixtures/customNode/autoRun'
import {
  LocalDesktopTarget,
  isServerSideFault
} from '@e2e/fixtures/customNode/ComfyTarget'
import {
  isForeignExecutionNoise,
  unallowlistedErrors,
  unallowlistedGlobalExtensionErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import { failureSummary } from '@e2e/fixtures/customNode/failureReport'
import {
  expectedNodeCountFor,
  loadAllManifestPackNames,
  loadManifest,
  packIdentity
} from '@e2e/fixtures/customNode/manifest'
import { describeRunOutcome } from '@e2e/fixtures/customNode/runResult'
import {
  assertPackLedgerKeys,
  packLedgerFor
} from '@e2e/fixtures/customNode/packLedger'
import type { CustomNodeTier } from '@e2e/fixtures/customNode/manifest'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { normalizeNodeDefs } from '@e2e/fixtures/customNode/typePairing'
import { eligibleNodeTypesForTier } from '@e2e/fixtures/customNode/tierNodeExclusions'
import {
  CANVAS_PREVIEW_IMAGE_PATH_PATTERN,
  initializationSignalsForTypes,
  matchesTopologyExpectation,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
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
import {
  attachPageDiagnosticEvidence,
  collectConsoleErrors
} from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  runWithCollectedCleanup,
  trackSubmittedPrompts,
  waitForQueueQuiet
} from '@e2e/fixtures/utils/customNodeSuite'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

const target = new LocalDesktopTarget()

// Measured optimum (deterministic across repeats, best ms/node); see PR.
const BATCH_SIZE = 24
const AUTO_RUN_BATCH = 10
const ROUNDTRIP_INITIALIZATION_TIMEOUT_MS = 30_000
// The auto-run disambiguation pass (re-run one node alone) waits longer than
// the batch does: by then we are timing a single node, so we can afford to
// distinguish "slow under load" from "genuinely hung" instead of misreading a
// slow CPU run as a regression.
const SINGLE_RERUN_TIMEOUT = 60_000
const GRID_SPACING = { x: 420, y: 360 }

type AllNodesTier = 'S1' | 'S2' | 'S3' | 'S9'

// Nodes unsafe to execute on a bare backend; every entry names the mechanism.
const AUTO_RUN_EXCLUDE: Record<string, Record<string, string>> = {
  'ComfyUI-Impact-Pack': {
    ImpactRemoteBoolean:
      'remote-control widget node; its executing signal flip-flops between PASS and PARTIAL run-to-run (same class as essentials TransitionMask+)',
    ImpactRemoteInt:
      'remote-control widget node; its executing signal flip-flops between PASS and PARTIAL run-to-run (same class as ImpactRemoteBoolean)',
    ImpactSchedulerAdapter:
      'executing signal flip-flops between PASS and PARTIAL run-to-run (same class as essentials TransitionMask+)',
    ImpactQueueTrigger:
      'queue-control node: backend execution emits impact-add-queue whenever its mode widget is on (the default), and the pack JS answers with a background app.queuePrompt whose re-entrancy refusal (app.processingQueue) then pins a bare VALIDATION_FAIL on whichever node the harness submits next',
    ImpactQueueTriggerCountdown:
      'queue-control node: backend execution emits impact-add-queue while counting, and the pack JS answers with a background app.queuePrompt whose re-entrancy refusal poisons the next harness submission (same emitter chain as ImpactQueueTrigger; the pack installs no submit-time queue hook)',
    ImageReceiver:
      'environment-variable execution: av.error.InvalidDataError decoding its default image on macOS, clean on Linux CI'
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
    'Text Random Prompt':
      'calls the Lexica API with requests.get and no timeout at execution; network-dependent',
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

// Exact pack-owned serialization changes. Every node must also appear in a
// renderer-specific index or key ledger.
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

interface DuplicateWidgetExpectation {
  counts: Record<string, number>
  reason: string
  restore: string
}

const MOUNT_WIDGET_DUPLICATE_EXPECTATIONS: Record<
  string,
  Record<string, DuplicateWidgetExpectation>
> = {
  'ComfyUI_Fill-Nodes': {
    FL_TimeLine: {
      counts: {
        frames_per_second: 2,
        interpolation_mode: 2,
        ipadapter_preset: 2,
        number_animation_frames: 2,
        video_height: 2,
        video_width: 2
      },
      reason:
        'the pinned pack JS adds six widgets already supplied by the Python node definition; Vue renders one row per unique widget identity',
      restore:
        'remove this expectation when the pack stops creating the duplicate widgets'
    }
  }
}

// The pack-attributed console-noise ledger moved to a shared fixture module
// (consoleErrorLedger.ts) so the curated run tier applies the same
// exceptions; this spec reads it through the shared filtering helpers above.

const PACK_LEDGERS: Record<string, Record<string, Record<string, unknown>>> = {
  AUTO_RUN_WIDGET_INPUTS,
  AUTO_RUN_EXCLUDE,
  CLOUD_RUN_EXCLUSIONS,
  MOUNT_WIDGET_DUPLICATE_EXPECTATIONS,
  OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH,
  OUTPUT_TOPOLOGY_EXPECTATIONS_VUE,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH,
  ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE,
  ROUNDTRIP_INITIALIZATION_SIGNALS,
  ROUNDTRIP_VALUE_ALLOWLIST,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE,
  ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH,
  ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE,
  WIDGET_SET_ALLOWLIST
}

for (const [name, ledger] of Object.entries(PACK_LEDGERS))
  assertPackLedgerKeys(name, ledger, loadAllManifestPackNames())

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

// Leave the shared backend idle after every test so the next test's fresh
// page never connects to a still-running execution and inherits its async
// errors (see drainBackendToIdle). This is what makes the tiers order- and
// run-independent on one shared backend.
test.afterEach(async ({ comfyPage }) => {
  expect(
    await drainBackendToIdle(comfyPage.page, 10_000),
    'test-owned backend work did not reach idle during cleanup'
  ).toBe(0)
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

function packNodeKeysFromDefs(
  defs: Record<string, RawNodeDef>,
  pack: string
): string[] {
  return normalizeNodeDefs(defs)
    .filter((node) => node.pack === pack)
    .map((node) => node.type)
    .sort()
}

// Packs that live under custom_nodes/ but are not community packs under test,
// keyed by the mechanism that puts them there. Same discipline as every other
// ledger: an entry carries its reason, and anything NOT listed must have a row.
const INFRASTRUCTURE_PACKS: Record<string, string> = {
  ComfyUI_devtools:
    'harness pack the suite installs to observe the backend; never under test',
  websocket_image_save:
    'ships inside ComfyUI core custom_nodes/ (comfyanonymous/ComfyUI), so it is core infrastructure the yaml does not list'
}

// The per-row count assert below catches drift INSIDE a known pack. It cannot
// catch a pack the backend registers that no manifest row covers, because the
// suite only iterates rows - a newly deployed pack would land with zero
// coverage and every existing assertion would stay green. Close the set both
// ways: the live custom-node pack set must equal the manifest's.
const manifestEntries = loadManifest()
const installedManifestPacks = manifestEntries.map((entry) => entry.pack)

test.describe('manifest covers every registered pack @custom-nodes', () => {
  test('no pack registers on the backend without a manifest row', async ({
    comfyPage
  }) => {
    const defs = (await comfyPage.page.evaluate(() =>
      window.app!.api.getNodeDefs()
    )) as unknown as Record<string, RawNodeDef>
    const live = new Set(
      normalizeNodeDefs(defs)
        .map((node) => node.pack)
        .filter((pack) => pack !== 'core' && !(pack in INFRASTRUCTURE_PACKS))
    )
    const covered = new Set(manifestEntries.map((entry) => entry.pack))
    const uncovered = [...live].filter((pack) => !covered.has(pack)).sort()
    expect(
      uncovered,
      `backend registers pack(s) with no manifest row: ${uncovered.join(', ')} - they have ZERO coverage; add the manifest row`
    ).toEqual([])
  })
})

type AllNodesTierRunner = {
  entry: ReturnType<typeof loadManifest>[number]
  run: (
    comfyPage: ComfyPage,
    tier: AllNodesTier,
    defs: Record<string, RawNodeDef>
  ) => Promise<void>
}

const allNodesTierRunners: AllNodesTierRunner[] = []

for (const entry of manifestEntries) {
  const registerAllNodesTests = () => {
    const expectAllNodesTier = async (
      comfyPage: ComfyPage,
      selectedTier: AllNodesTier,
      defs: Record<string, RawNodeDef>
    ) => {
      const registeredKeys = packNodeKeysFromDefs(defs, entry.pack)
      expect(
        registeredKeys.length,
        `${entry.pack} not installed on this backend`
      ).toBeGreaterThan(0)
      async function runTier(
        selectedBy: AllNodesTier[],
        tier: () => Promise<void>
      ) {
        if (!selectedBy.includes(selectedTier)) return
        await runWithCollectedCleanup(tier, [
          () => comfyPage.nodeOps.clearGraph(),
          async () => {
            expect(
              await drainBackendToIdle(comfyPage.page, 10_000),
              `${entry.pack} left test-owned backend work running`
            ).toBe(0)
          }
        ])
      }

      await runTier(['S1', 'S2'], async () => {
        // Exact-count guard: the corpus below comes from the live backend, so
        // a pack silently registering fewer nodes (broken sub-import, a core
        // change breaking registration) would shrink coverage while every
        // remaining assertion stays green. At a fixed pin the count is
        // deterministic; a delta in either direction fails until the manifest
        // is deliberately recalibrated with the pin/core change that moved it.
        console.log(
          `custom-nodes count: ${entry.pack} = ${registeredKeys.length}`
        )
        expect(
          registeredKeys,
          `${entry.pack} registers ${registeredKeys.length} nodes but ${expectedNodeCountFor(entry)} are expected on this backend - a pack node failed to register (or the pack changed); recalibrate only with the change that moved it`
        ).toHaveLength(expectedNodeCountFor(entry))
        const keys = eligibleNodeTypesForTier(
          { identity: packIdentity(entry), pack: entry.pack },
          selectedTier === 'S1' ? 'S1' : 'S2',
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

        const rendererPasses =
          selectedTier === 'S1'
            ? [false]
            : selectedTier === 'S2'
              ? [true]
              : [false, true]
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
              const present = new Set([
                ...shape.widgetNames,
                ...shape.inputNames
              ])
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
              if (!vueNodesEnabled) continue
              const visible = await comfyPage.page
                .locator(`[data-node-id="${shape.id}"]`)
                .waitFor({ state: 'visible', timeout: 2_000 })
                .then(() => true)
                .catch(() => false)
              if (!visible) failures.push(`${key}: no Vue mount`)
            }
            // A mount with missing widgets or slots is a broken node, not a
            // pass. Extra DOM elements are tolerated; missing ones fail.
            if (vueNodesEnabled)
              failures.push(
                ...(await comfyPage.page.evaluate(
                  ([chunkIds, expectedDuplicatesByNode]) => {
                    const problems: string[] = []
                    for (const id of chunkIds) {
                      if (id === null) continue
                      const node = window.app!.graph.nodes.find(
                        (candidate) => String(candidate.id) === id
                      )
                      const root = document.querySelector(
                        `[data-node-id="${id}"]`
                      )
                      if (!node || !root) continue
                      const widgets = (
                        (node.widgets ?? []) as Array<{
                          advanced?: boolean
                          name?: string
                          type?: string
                          options?: {
                            advanced?: boolean
                            canvasOnly?: boolean
                            hidden?: boolean
                          }
                        }>
                      ).filter(
                        (widget) =>
                          !!widget.type &&
                          widget.type !== 'converted-widget' &&
                          !widget.options?.canvasOnly &&
                          !(widget.options?.advanced ?? widget.advanced) &&
                          !widget.options?.hidden &&
                          // Vue renders the seed-control combo inside its
                          // parent widget row, not as its own row.
                          widget.name !== 'control_after_generate'
                      )
                      const domWidgets = root.querySelectorAll(
                        '[data-testid="node-widget"]'
                      ).length
                      const expectedDuplicates =
                        expectedDuplicatesByNode[node.type!]
                      if (expectedDuplicates) {
                        const widgetNameCounts: Record<string, number> = {}
                        for (const widget of widgets)
                          widgetNameCounts[widget.name ?? ''] =
                            (widgetNameCounts[widget.name ?? ''] ?? 0) + 1
                        const observedDuplicates = Object.fromEntries(
                          Object.entries(widgetNameCounts)
                            .filter(([, count]) => count > 1)
                            .sort(([left], [right]) =>
                              left.localeCompare(right)
                            )
                        )
                        const expectedDuplicateCounts = Object.fromEntries(
                          Object.entries(expectedDuplicates.counts).sort(
                            ([left], [right]) => left.localeCompare(right)
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
                      } else if (domWidgets < widgets.length)
                        problems.push(
                          `${node.type}: Vue mounts ${domWidgets} of ${widgets.length} widgets`
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
                    duplicateWidgetExpectations
                  ] as const
                ))
              )
          }
          consoleErrors.stop()
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
            console.log(
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
      })

      await runTier(['S3'], async () => {
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
        const allowedValueDrift = packLedgerFor(
          ROUNDTRIP_VALUE_ALLOWLIST,
          entry.pack
        )
        for (const ledgered of Object.keys(allowedValueDrift))
          expect(
            keys,
            `stale ROUNDTRIP_VALUE_ALLOWLIST entry: ${ledgered} is not registered by ${entry.pack}`
          ).toContain(ledgered)
        const exactValueDriftNodes = new Set(
          [
            packLedgerFor(
              ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH,
              entry.pack
            ),
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
        // Widget values flow through the same store in both renderers, but
        // only the Vue pass runs component mount/configure effects that can
        // write back into that store - so the round-trip must hold under
        // both. Each stage yields a frame so those effects actually flush
        // before the next serialize (a single evaluate would serialize before
        // any Vue component reacted).
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
            // Stage 1 - create the chunk and park the comparison rig on the
            // window; its closures carry state across the staged evaluates.
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
                    (widget) =>
                      widget.type === 'button' && widget.name === 'upload'
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
                // Serialized widgets_values can be an array or a named object;
                // reload may legitimately APPEND entries (control_after_generate
                // materializes, packs add value-driven dynamic widgets) but must
                // never lose or change what was saved.
                const preserves = (
                  before: unknown,
                  after: unknown
                ): boolean => {
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
                      (node.widgets ?? [])
                        .map((widget) => widget.name)
                        .join(',')
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
                      if (expected)
                        expected.widgetCount = (node.widgets ?? []).length
                    }
                  },
                  previewWidgetState() {
                    const requiredByNode: Record<string, string[]> = {}
                    const observedByNode: Record<string, string[]> = {}
                    for (const [id, expected] of created) {
                      if (expected.previewWidgetNames.length === 0) continue
                      requiredByNode[expected.type] =
                        expected.previewWidgetNames
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
                        (pass.nodes ?? []).map((node) => [
                          String(node.id),
                          node
                        ])
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
                          problems.push(
                            `${expected.type}: lost on ${label} reload`
                          )
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
                        continue
                      const allowedIndices =
                        exactValueDriftIndices[expected.type]
                      if (
                        allowedIndices &&
                        Array.isArray(before.widgets_values) &&
                        Array.isArray(after.widgets_values) &&
                        after.widgets_values.length >=
                          before.widgets_values.length
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
                              valueDrifts.get(expected.type) ??
                              new Set<number>()
                            observed.add(index)
                            valueDrifts.set(expected.type, observed)
                          }
                        if (
                          changed.every((index) =>
                            allowedIndices.includes(index)
                          )
                        )
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
                        const changed = Object.entries(
                          beforeWidgetValues
                        ).flatMap(([key, value]) =>
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
                      if (
                        !preserves(before.widgets_values, after.widgets_values)
                      )
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
                      for (const widget of node.widgets ?? []) {
                        if (!SETTABLE.has(String(widget.type))) continue
                        if (`${nodeType}.${widget.name}` in packManaged)
                          continue
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
                            if (
                              options?.min === undefined ||
                              down >= options.min
                            )
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
                    const pendingInitialization =
                      pendingRoundtripInitializations(
                        chunkInitializationSignals,
                        values,
                        vueNodesEnabled
                      )
                    const previewWidgetState = await comfyPage.page.evaluate(
                      () => window.__cnRt!.previewWidgetState()
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
            // Stage 2 - pristine snapshot + reload.
            await comfyPage.page.evaluate(() =>
              window.__cnRt!.snapshotAndConfigure()
            )
            await comfyPage.nextFrame()
            await waitForInitialization()
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
            await waitForInitialization()
            // Stage 5 - set-values verdict; collect and reset.
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
              [...observedValueDrift].map(([node, indices]) => [
                node,
                [...indices]
              ])
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
      })

      await runTier(['S9'], async () => {
        const keys = registeredKeys
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)

        // A prior pack's slow CPU execution can still be draining when this tier
        // starts (all packs share one backend, locally and on CI alike; CI's
        // unloaded runner keeps executions fast, a busy local machine may not).
        // That work belongs to an earlier test's page, so it is invisible to
        // drainBackendToIdle and must not be cancelled by us: wait it out
        // instead. Slow-but-finite executions drain within the budget; only a
        // truly wedged backend (which the exclusions already prevent) stays busy
        // past it. The wait is free when the queue is already idle.
        const queueBusy = await waitForQueueQuiet(comfyPage.page, 150_000)
        expect(
          queueBusy,
          'the backend still has a running prompt after a 150s wait - a genuinely wedged (non-interruptible) execution; restart the test backend'
        ).toBe(0)

        const explicitRunExclusions = packLedgerFor(
          CLOUD_RUN_EXCLUSIONS,
          entry.pack
        )
        const excluded = {
          ...packLedgerFor(AUTO_RUN_EXCLUDE, entry.pack),
          ...Object.fromEntries(
            Object.entries(explicitRunExclusions).map(([node, exclusion]) => [
              node,
              exclusion.reason
            ])
          )
        }
        for (const key of Object.keys(excluded))
          expect(
            keys,
            `stale AUTO_RUN_EXCLUDE entry: ${key} is not registered by ${entry.pack}`
          ).toContain(key)
        for (const [key, reason] of Object.entries(excluded))
          console.log(
            `${entry.pack}: ${key} excluded from auto-run (${reason})`
          )
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
        const expectedRunnableCount = entry.expectedRunnableCount
        if (expectedRunnableCount === undefined)
          throw new Error(`${entry.pack} run tier has no runnable corpus`)
        expect(
          batches.flat(),
          `${entry.pack} runnable corpus changed - inspect classifier or object_info drift before recalibrating`
        ).toHaveLength(expectedRunnableCount)
        const hardFailures: string[] = []
        const cannotRun = new Map<string, string>()
        const ranClean = new Set<string>()
        // A server-side 5xx means the backend is failing, not this batch's
        // nodes: stop submitting, but keep every verdict already collected -
        // real failures found before the fault take precedence over it and
        // must still be reported (the abort is appended after them below).
        let environmentAbort: string | undefined
        batchLoop: for (const batch of batches) {
          let outcome: string
          try {
            outcome = await runBatch(comfyPage.page, entry.pack, batch)
          } catch (error) {
            if (!isServerSideFault(error)) throw error
            environmentAbort = `[${batch.map((verdict) => verdict.key).join(', ')}]: ${error.message} - remaining auto-runs skipped`
            break
          }
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
            let single: string
            try {
              single = await runBatch(
                comfyPage.page,
                entry.pack,
                [verdict],
                SINGLE_RERUN_TIMEOUT
              )
            } catch (error) {
              if (!isServerSideFault(error)) throw error
              environmentAbort = `${verdict.key}: ${error.message} - remaining auto-runs skipped`
              break batchLoop
            }
            if (single === 'PASS') ranClean.add(verdict.key)
            else if (single.startsWith('HUNG_BACKEND')) {
              hardFailures.push(
                `${verdict.key}: ${single} - add to AUTO_RUN_EXCLUDE with its mechanism`
              )
              break batchLoop
            } else cannotRun.set(verdict.key, single)
          }
        }
        // Two-way reconciliation: unlisted failure = regression; listed node
        // that runs clean (or is not auto-runnable) = stale entry.
        const baseline = new Set(entry.cannotRunAlone ?? [])
        const runnable = new Set(
          batches.flatMap((batch) => batch.map((verdict) => verdict.key))
        )
        for (const [key, detail] of cannotRun) {
          if (!baseline.has(key))
            hardFailures.push(
              `${key}: ${detail} - not in cannotRunAlone; a regression, or a new baseline entry (attach the run log)`
            )
        }
        for (const key of baseline) {
          if (ranClean.has(key))
            hardFailures.push(
              `${key}: ran clean but is listed in cannotRunAlone - remove the stale entry, or re-derive the baseline if it predates execution_cached accounting (a PARTIAL from a warm backend cache used to read as cannot-run)`
            )
          else if (!runnable.has(key))
            hardFailures.push(
              `${key}: listed in cannotRunAlone but is not auto-runnable on this backend - remove the stale entry`
            )
        }
        console.log(
          `${entry.pack} auto-ran ${ranClean.size} node(s) clean; ${cannotRun.size} cannot run alone (baseline ${baseline.size})`
        )
        // Appended last: per-node failures keep precedence over the 5xx.
        if (environmentAbort !== undefined) hardFailures.push(environmentAbort)
        const autoRunFailureSummary = failureSummary(
          `${entry.pack} auto-run failures`,
          hardFailures,
          'auto-run-failures.json'
        )
        if (hardFailures.length > 0) {
          console.log(autoRunFailureSummary)
          await attachPageDiagnosticEvidence(
            test.info(),
            'auto-run-failures.json',
            hardFailures
          )
        }
        expect(hardFailures.length === 0, autoRunFailureSummary).toBe(true)
      })
    }

    allNodesTierRunners.push({ entry, run: expectAllNodesTier })
  }

  registerAllNodesTests()
}

const tiers: Array<[AllNodesTier, string]> = [
  ['S1', 'every enrolled registered node mounts on the canvas renderer'],
  ['S2', 'every enrolled registered node mounts on the DOM renderer'],
  ['S3', 'enrolled registered-node save/reload outcomes match exact contracts'],
  ['S9', 'calibrated model-free node corpus executes']
]

// The capability each tier needs from a pack's manifest row. Mounting and
// save/reload are frontend work every loadable pack owes; executing a node is
// not, and the row says so. These tiers used to sweep whatever the backend
// registered, which meant S9 executed every node of every installed pack no
// matter what its row asked for - 17.6 of one shard's 21.1 minutes on run
// 31842166428, for packs that declare load and connectivity only.
const TIER_REQUIRES: Record<AllNodesTier, CustomNodeTier> = {
  S1: 'load',
  S2: 'load',
  S3: 'load',
  S9: 'run'
}

const runnersForTier = (tier: AllNodesTier): AllNodesTierRunner[] =>
  allNodesTierRunners.filter((runner) =>
    runner.entry.tiers.includes(TIER_REQUIRES[tier])
  )

test.describe('all nodes by tier @custom-nodes', () => {
  for (const [tier, title] of tiers) {
    const tierRunners = runnersForTier(tier)
    // Registered only when a pack in this slice asks for it: a tier with no
    // packs would otherwise be a skip, and the gate forbids skips because a
    // skip is how lost coverage reads as a pass.
    if (tierRunners.length === 0) continue

    test(`${tier}: ${title}`, async ({ comfyPage }) => {
      // Run 32066027848 measured shard maxima of 14s/48s/74s for S1/S2/S3.
      // Scale with the exact corpus and retain at least 4x observed headroom;
      // S9 instead budgets each possible single-node diagnostic rerun.
      const nodeCount = tierRunners.reduce(
        (sum, runner) => sum + expectedNodeCountFor(runner.entry),
        0
      )
      const timeoutMs =
        tier === 'S1'
          ? 30_000 + nodeCount * 120
          : tier === 'S2'
            ? 30_000 + nodeCount * 350
            : tier === 'S3'
              ? 30_000 + nodeCount * 500
              : 60_000 +
                tierRunners.reduce(
                  (sum, runner) =>
                    sum + (runner.entry.expectedRunnableCount ?? 0) * 30_000,
                  0
                )
      test.setTimeout(timeoutMs)
      await comfyPage.page.evaluate((activeTier) => {
        Object.assign(globalThis, {
          __COMFY_CUSTOM_NODE_DETECTION_PROOF_TIER__: activeTier
        })
      }, tier)
      const pageId = await comfyPage.page.evaluate(() => {
        const key = '__customNodeTierPageId'
        const existing = sessionStorage.getItem(key)
        if (existing) return existing
        const created = crypto.randomUUID()
        sessionStorage.setItem(key, created)
        return created
      })
      console.warn(
        `[tier-session] pid=${process.pid} tier=${tier} pageId=${pageId}`
      )

      const defs = (await comfyPage.page.evaluate(() =>
        window.app!.api.getNodeDefs()
      )) as unknown as Record<string, RawNodeDef>
      const failures: string[] = []
      for (const runner of tierRunners) {
        let result = 'pass'
        try {
          await runner.run(comfyPage, tier, defs)
        } catch (error) {
          result = 'fail'
          const errors =
            error instanceof AggregateError ? error.errors : [error]
          failures.push(
            `[${runner.entry.pack}] ${errors
              .map((entry) =>
                entry instanceof Error ? entry.message : String(entry)
              )
              .join('\n')}`
          )
        }
        console.log(
          `[tier-pack] tier=${tier} pack=${runner.entry.pack} result=${result}`
        )
      }
      const attachment = `${tier.toLowerCase()}-failures.json`
      if (failures.length > 0)
        await attachPageDiagnosticEvidence(test.info(), attachment, failures)
      expect(
        failures.length === 0,
        failureSummary(`${tier} pack failures`, failures, attachment)
      ).toBe(true)
    })
  }
})

async function runBatch(
  page: Page,
  pack: string,
  batch: Array<{
    key: string
    needsPreviewSink?: boolean
    requiredSockets?: RequiredSocket[]
  }>,
  timeoutMs: number = 20_000
): Promise<string> {
  const batchWithInputs = batch.map((spec) => ({
    ...spec,
    widgetInputs: packLedgerFor(AUTO_RUN_WIDGET_INPUTS, pack)[spec.key]
  }))
  const { ids, allIds, nodeIdByKey, sinkIdByKey } = await page.evaluate(
    ([nodes, producers, spacingY]) => {
      window.app!.graph.clear()
      window.app!.graph.last_node_id = window.__cnIdBase ?? 0
      const ids: string[] = []
      const allIds: string[] = []
      const nodeIdByKey: Record<string, string> = {}
      const sinkIdByKey: Record<string, string> = {}
      for (const [index, spec] of nodes.entries()) {
        const node = window.LiteGraph!.createNode(spec.key)
        if (!node) continue
        node.pos = [0, index * (spacingY as number)]
        window.app!.graph.add(node)
        ids.push(String(node.id))
        allIds.push(String(node.id))
        nodeIdByKey[spec.key] = String(node.id)
        for (const [name, value] of Object.entries(spec.widgetInputs ?? {})) {
          const widget = node.widgets?.find(
            (candidate) => candidate.name === name
          )
          if (!widget)
            throw new Error(
              `${spec.key}: required fixture widget ${name} is missing`
            )
          widget.value = value
        }
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
      return { ids, allIds, nodeIdByKey, sinkIdByKey }
    },
    [batchWithInputs, SYNTH_PRODUCERS, GRID_SPACING.y] as const
  )
  // Batch default 20s = hung; the single re-run pass raises it (see caller)
  // so a node that is merely slow under load is not misread as a regression.
  const result = await target.runWorkflow(page, {
    expectedNodeIds: ids,
    graphNodeIds: allIds,
    proofOutputNodeByExpectedNode: Object.fromEntries(
      Object.entries(sinkIdByKey).map(([key, sinkId]) => [
        nodeIdByKey[key],
        sinkId
      ])
    ),
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
  return describeRunOutcome(result)
}
