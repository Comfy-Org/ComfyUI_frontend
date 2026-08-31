import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'

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
import { failureSummary } from '@e2e/fixtures/customNode/failureReport'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'
import { loadAllManifestPackNames } from '@e2e/fixtures/customNode/manifest'
import {
  assertPackLedgerKeys,
  packLedgerFor
} from '@e2e/fixtures/customNode/packLedger'
import { describeRunOutcome } from '@e2e/fixtures/customNode/runResult'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { attachPageDiagnosticEvidence } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  drainBackendToIdle,
  waitForQueueQuiet
} from '@e2e/fixtures/utils/customNodeSuite'

const AUTO_RUN_BATCH = 10
const SINGLE_RERUN_TIMEOUT = 60_000
const GRID_SPACING = { y: 360 }
const target = new LocalDesktopTarget()

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
      'queue-control node: backend execution emits impact-add-queue while counting, and the pack JS answers with a background app.queuePrompt whose re-entrancy refusal poisons the next harness submission (same emitter chain as ImpactQueueTrigger; the pack installs no submit-time queue hook)'
  },
  'ComfyUI-KJNodes': {
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
    'Image Crop Face':
      'environment-variable execution: clean on macOS, AttributeError on Linux CI (OpenCV cascade lookup differs)'
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

const manifestPackNames = loadAllManifestPackNames()
assertPackLedgerKeys(
  'AUTO_RUN_WIDGET_INPUTS',
  AUTO_RUN_WIDGET_INPUTS,
  manifestPackNames
)
assertPackLedgerKeys('AUTO_RUN_EXCLUDE', AUTO_RUN_EXCLUDE, manifestPackNames)
assertPackLedgerKeys(
  'CLOUD_RUN_EXCLUSIONS',
  CLOUD_RUN_EXCLUSIONS,
  manifestPackNames
)

export async function assertExecutionTier({
  comfyPage,
  entry,
  defs,
  registeredKeys
}: {
  comfyPage: ComfyPage
  entry: CoreManifestEntry | CloudManifestEntry
  defs: Record<string, RawNodeDef>
  registeredKeys: string[]
}): Promise<void> {
  const keys = registeredKeys
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)

  const queueBusy = await waitForQueueQuiet(comfyPage.page, 150_000)
  expect(
    queueBusy,
    'the backend still has a running prompt after a 150s wait - a genuinely wedged (non-interruptible) execution; restart the test backend'
  ).toBe(0)

  const explicitRunExclusions = packLedgerFor(CLOUD_RUN_EXCLUSIONS, entry.pack)
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
    console.warn(`${entry.pack}: ${key} excluded from auto-run (${reason})`)
  const verdicts = planAutoRuns(
    defs,
    keys.filter((key) => !(key in excluded))
  )
  const counts = new Map<string, number>()
  for (const verdict of verdicts)
    counts.set(verdict.verdict, (counts.get(verdict.verdict) ?? 0) + 1)
  console.warn(
    `${entry.pack} auto-run plan: ${[...counts.entries()]
      .map(([verdict, count]) => `${verdict}=${count}`)
      .join(' ')}`
  )

  const batches = batchAutoRunnable(verdicts, AUTO_RUN_BATCH)
  const runnableNodeTypesSha256 = createHash('sha256')
    .update(
      batches
        .flatMap((batch) => batch.map(({ key }) => key))
        .sort()
        .join('\n')
    )
    .digest('hex')
  console.warn(
    `${entry.pack} runnable corpus: count=${batches.flat().length} sha256=${runnableNodeTypesSha256}`
  )
  const expectedRunnableCount = entry.expectedRunnableCount
  if (expectedRunnableCount === undefined)
    throw new Error(`${entry.pack} run tier has no runnable corpus`)
  expect(
    batches.flat(),
    `${entry.pack} runnable corpus changed - inspect classifier or object_info drift before recalibrating`
  ).toHaveLength(expectedRunnableCount)
  expect(
    runnableNodeTypesSha256,
    `${entry.pack} runnable node identities changed - inspect classifier or object_info drift before recalibrating`
  ).toBe(entry.expectedRunnableNodeTypesSha256)
  const hardFailures: string[] = []
  const cannotRun = new Map<string, string>()
  const ranClean = new Set<string>()
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
    if (outcome.startsWith('HUNG_BACKEND')) {
      hardFailures.push(
        `[${batch.map((verdict) => verdict.key).join(', ')}]: ${outcome} - add the offender to AUTO_RUN_EXCLUDE with its mechanism`
      )
      break
    }
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
  console.warn(
    `${entry.pack} auto-ran ${ranClean.size} node(s) clean; ${cannotRun.size} cannot run alone (baseline ${baseline.size})`
  )
  if (environmentAbort !== undefined) hardFailures.push(environmentAbort)
  const autoRunFailureSummary = failureSummary(
    `${entry.pack} auto-run failures`,
    hardFailures,
    'auto-run-failures.json'
  )
  if (hardFailures.length > 0) {
    console.warn(autoRunFailureSummary)
    await attachPageDiagnosticEvidence(
      test.info(),
      'auto-run-failures.json',
      hardFailures
    )
  }
  expect(hardFailures.length === 0, autoRunFailureSummary).toBe(true)
}

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
        const node = window.LiteGraph!.createNode(spec.key, undefined, {
          pos: [0, index * (spacingY as number)]
        })
        if (!node) throw new Error(`${spec.key}: createNode returned null`)
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
          if (inputIndex < 0) continue
          const producer = producers[socket.type]
          const producerNode = window.LiteGraph!.createNode(
            producer.nodeType,
            undefined,
            {
              pos: [
                -420 - socketIndex * 40,
                index * (spacingY as number) + socketIndex * 90
              ]
            }
          )
          if (!producerNode) continue
          window.app!.graph.add(producerNode)
          allIds.push(String(producerNode.id))
          producerNode.connect(producer.outputIndex, node, inputIndex)
        }
        if (spec.needsPreviewSink) {
          const sink = window.LiteGraph!.createNode('PreviewAny', undefined, {
            pos: [460, index * (spacingY as number)]
          })!
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
    if ((await drainBackendToIdle(page, 90_000)) !== 0)
      return 'HUNG_BACKEND (non-interruptible execution; backend restart required)'
  }
  if (result.outcome === 'PASS') {
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
