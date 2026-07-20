import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodeSuiteSettings,
  dismissTemplatesDialog,
  drainBackendToIdle
} from '@e2e/fixtures/utils/customNodeSuite'
import {
  isForeignExecutionNoise,
  unallowlistedErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import { loadManifest } from '@e2e/fixtures/customNode/manifest'
import type {
  ConnectivityOutcome,
  PlannedPair,
  RawNodeDef
} from '@e2e/fixtures/customNode/typePairing'
import {
  isWildcard,
  normalizeNodeDefs,
  planPairs
} from '@e2e/fixtures/customNode/typePairing'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

const CORE_PROOF_NODE_COUNT = 16
// A node may legitimately veto a wiring via onConnectInput; committed
// entries here must name the veto. Green means actual rejections are a
// subset of this list.
const CONNECT_REJECTED_ALLOWLIST: string[] = [
  // pysssss MathExpression only accepts INT/FLOAT-producing links into its
  // expression variables; its JS vetoes text-list producers.
  'AddTextPrefix.texts -> MathExpression|pysssss.expression'
]
// Pairs whose creation/wiring THROWS inside the pack's own JS. Filter-guarded
// ONLY, deliberately outside the observed-firing stale guard: the throw is a
// timing race (it fires when the KJNodes editor_base creation crash lands
// before this node's instantiation, and passes on runners where it doesn't -
// observed failing 2026-07-18, passing 2026-07-20 at the IDENTICAL core SHA),
// and ARCHITECTURE section 10's rule is that environment-conditional
// failures get filter guards, never observed-firing guards that false-fail.
const SLOT_CONTRACT_MISMATCH_ALLOWLIST: string[] = [
  // TimerNodeKJ's widget JS throws `null.replace` when instantiated in the
  // sweep after the editor_base crash contaminates shared state
  // (single-creation mount stays clean). Part of the 2026-07-18 core-drift
  // incident. Upstream-report candidate.
  'TimerNodeKJ.timer -> TimerNodeKJ.timer',
  'TimerNodeKJ.time -> AddLabel.text_x'
]
// A pack's own serialize/configure hooks may drop links it manages itself
// (reproducible manually: wire, save, reload - link gone). Pack behavior on
// record, not frontend regressions.
const ROUNDTRIP_LOST_ALLOWLIST: string[] = [
  // rgthree SDXL Power Prompt rebuilds its dimension widget-inputs during
  // configure and drops inbound links to them.
  'BatchCount+.INT -> SDXL Power Prompt - Positive (rgthree).target_width',
  'BatchCount+.INT -> SDXL Power Prompt - Positive (rgthree).target_height',
  'BatchCount+.INT -> SDXL Power Prompt - Positive (rgthree).crop_width',
  'BatchCount+.INT -> SDXL Power Prompt - Positive (rgthree).crop_height',
  'BatchCount+.INT -> SDXL Power Prompt - Simple / Negative (rgthree).target_width',
  'BatchCount+.INT -> SDXL Power Prompt - Simple / Negative (rgthree).target_height',
  'BatchCount+.INT -> SDXL Power Prompt - Simple / Negative (rgthree).crop_width',
  'BatchCount+.INT -> SDXL Power Prompt - Simple / Negative (rgthree).crop_height',
  // VHS_SelectLatest rebuilds its dynamic slots on configure, detaching
  // links on both its inputs and outputs.
  'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
  'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
  'VHS_SelectLatest.Filename -> AddLabel.font_color'
]

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  await dismissTemplatesDialog(comfyPage)
})

// Leave the shared backend idle so the next test starts clean (drainBackendToIdle).
test.afterEach(async ({ comfyPage }) => {
  // The drain is a no-op when the queue is already idle, so it costs
  // ~nothing in the common path; the 10s ceiling only bounds a genuinely
  // busy backend. A backend still busy past it is wedged, and the auto-run
  // tier's 150s guard surfaces that with the restart diagnostic.
  await drainBackendToIdle(comfyPage.page, 10_000)
})

function concrete(slot: { type: string }): boolean {
  return !isWildcard(slot.type)
}

function isEntryInstalled(
  nodeTypes: Set<string>,
  entry: { expectedNodes: string[] }
): boolean {
  return entry.expectedNodes.every((type) => nodeTypes.has(type))
}

const connectivityEntries = loadManifest().filter((entry) =>
  entry.tiers.includes('connectivity')
)

test('connectivity: every type-paired link survives model, serialize, and prompt round-trips @custom-nodes', async ({
  comfyPage
}) => {
  test.setTimeout(120_000)
  const defs = (await comfyPage.page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const nodes = normalizeNodeDefs(defs)

  // Pack-specific expectations apply only where the pack is installed; on a
  // backend without it (e.g. a generic CI runner) the core sweep still runs
  // and the absence is reported, never fake-failed or fake-passed.
  const nodeTypes = new Set(nodes.map((node) => node.type))
  const installedEntries = connectivityEntries.filter((entry) =>
    isEntryInstalled(nodeTypes, entry)
  )
  for (const entry of connectivityEntries)
    if (!installedEntries.includes(entry))
      console.log(`connectivity: ${entry.pack} not installed on this backend`)
  // Corpus = every node the installed packs register, from the live backend.
  const installedPacks = new Set(installedEntries.map((entry) => entry.pack))
  const packTypes = nodes
    .filter((node) => installedPacks.has(node.pack))
    .map((node) => node.type)
  const coreProof = nodes
    .filter(
      (node) =>
        node.pack === 'core' &&
        node.inputs.some(concrete) &&
        node.outputs.some(concrete)
    )
    .map((node) => node.type)
    .sort()
    .slice(0, CORE_PROOF_NODE_COUNT)
  const plan = planPairs(nodes, [...packTypes, ...coreProof])

  expect(plan.pairs.length, 'pairing produced no edges').toBeGreaterThan(0)
  console.log(
    `connectivity plan: ${plan.pairs.length} pairs, ${plan.orphans.length} orphan slots, ${plan.wildcards.length} wildcard + ${plan.combos.length} combo slots (excluded by design), ${plan.unknownShapes.length} unknown-shape slots (recorded: ${plan.unknownShapes.join('; ') || 'none'})`
  )

  for (const entry of installedEntries) {
    expect(
      plan.pairs.some(
        (pair) =>
          pair.producer.pack === entry.pack || pair.consumer.pack === entry.pack
      ),
      `${entry.pack} contributes no pairs - corpus or pack attribution broke`
    ).toBe(true)
  }

  // The breadth sweep runs under one renderer by design: it exercises
  // graph-API link creation, the real isValidConnection veto, and
  // serialize/configure survival - all renderer-independent paths (widget
  // values and links flow through the same stores in both renderers). The
  // curated drag test below covers real pointer wiring under BOTH renderers.
  const consoleErrors = collectConsoleErrors(comfyPage.page)
  const results = await runPairsInPage(comfyPage.page, plan.pairs)
  consoleErrors.stop()
  // Routed through the pack console ledger scoped to the packs actually in
  // the corpus (the escape hatch this assert always documented): a KJNodes
  // SplineEditor creation crash fired on 2026-07-18 when core's new partner
  // nodes reshuffled the pair plan, and the ledger row carries its mechanism
  // and upstream-report status. Every non-ledgered error still fails. The
  // wiring sweep queues no prompts, so a prompt-execution error here is a
  // prior tier's async stray, not this test's (isForeignExecutionNoise;
  // ARCHITECTURE section 9 principle).
  const sweepErrors = consoleErrors.errors.filter(
    (error) => !isForeignExecutionNoise(error)
  )
  const unledgered = unallowlistedErrorsForPacks(
    [...installedPacks],
    sweepErrors
  )
  if (sweepErrors.length > unledgered.length)
    console.log(
      `connectivity sweep: ${sweepErrors.length - unledgered.length} console error(s) matched an installed pack's allowlist`
    )
  expect(unledgered, 'console errors during breadth sweep').toEqual([])

  const widgetOnly = results.filter(
    (result) =>
      result.outcome ===
      ('WIDGET_ONLY_ON_INSTANCE' satisfies ConnectivityOutcome)
  )
  if (widgetOnly.length > 0)
    console.log(
      `connectivity sweep: ${widgetOnly.length} pair(s) excluded - pack JS made the declared input widget-only: ${widgetOnly.map((result) => result.key).join('; ')}`
    )
  const failures = results.filter(
    (result) =>
      result.outcome !== ('PASS' satisfies ConnectivityOutcome) &&
      result.outcome !==
        ('WIDGET_ONLY_ON_INSTANCE' satisfies ConnectivityOutcome) &&
      !(
        result.outcome === ('CONNECT_REJECTED' satisfies ConnectivityOutcome) &&
        CONNECT_REJECTED_ALLOWLIST.includes(result.key)
      ) &&
      !(
        result.outcome === ('ROUNDTRIP_LOST' satisfies ConnectivityOutcome) &&
        ROUNDTRIP_LOST_ALLOWLIST.includes(result.key)
      ) &&
      !(
        result.outcome ===
          ('SLOT_CONTRACT_MISMATCH' satisfies ConnectivityOutcome) &&
        SLOT_CONTRACT_MISMATCH_ALLOWLIST.includes(result.key)
      )
  )
  const passed = results.filter((result) => result.outcome === 'PASS').length
  console.log(`connectivity sweep: ${passed}/${results.length} pairs PASS`)
  expect(failures, JSON.stringify(failures, null, 1)).toEqual([])
  expect(passed).toBeGreaterThan(0)
  // Two-way guard, same discipline as cannotRunAlone: every allowlisted key
  // must still be OBSERVED failing in its recorded way. An entry whose pair
  // now passes (or is no longer even planned) is stale and would silently
  // hide the fixed bug behind it. On a partially-installed local backend an
  // absent key only logs; CI installs every pack, so it always enforces.
  const outcomeByKey = new Map(
    results.map((result) => [result.key, result.outcome])
  )
  const allPacksInstalled =
    installedEntries.length === connectivityEntries.length
  const staleEntries: string[] = []
  // SLOT_CONTRACT_MISMATCH_ALLOWLIST is deliberately absent here: its
  // failures are timing-conditional (see its comment), so demanding they
  // fire every run false-fails on fast runners.
  for (const [allowlist, expected] of [
    [CONNECT_REJECTED_ALLOWLIST, 'CONNECT_REJECTED'],
    [ROUNDTRIP_LOST_ALLOWLIST, 'ROUNDTRIP_LOST']
  ] as const)
    for (const key of allowlist) {
      const observed = outcomeByKey.get(key)
      if (observed === undefined && !allPacksInstalled) {
        console.log(
          `allowlist entry not observed (pack not installed here): ${key}`
        )
        continue
      }
      if (observed !== expected)
        staleEntries.push(
          `${key}: expected ${expected}, observed ${observed ?? 'nothing'} - remove the stale entry`
        )
    }
  expect(staleEntries, 'stale allowlist entries').toEqual([])
  await expectNoVisibleErrors(comfyPage.page, 'after breadth sweep')
})

// First planned pair whose slots both exist on real instances (pack JS can
// rebuild declared inputs as widget-only controls).
function firstMaterializedPair(
  page: Page,
  pairs: PlannedPair[]
): Promise<PlannedPair | null> {
  return page.evaluate((pairsInPage) => {
    for (const pair of pairsInPage) {
      const producer = window.LiteGraph!.createNode(pair.producer.nodeType)
      const consumer = window.LiteGraph!.createNode(pair.consumer.nodeType)
      const outFound = producer?.outputs.some(
        (slot) => slot.name === pair.producer.slotName
      )
      const inFound = consumer?.inputs.some(
        (slot) => slot.name === pair.consumer.slotName
      )
      if (outFound && inFound) return pair
    }
    return null
  }, pairs)
}

// The self-check below runs THIS SAME executor on poisoned pairs; if it stops
// being able to reject, every green sweep above is meaningless.
function runPairsInPage(
  page: Page,
  pairs: PlannedPair[]
): Promise<Array<{ key: string; outcome: string; detail?: string }>> {
  return page.evaluate(async (pairsInPage) => {
    const graph = window.app!.graph
    const report: Array<{
      key: string
      outcome: string
      detail?: string
    }> = []
    for (const pair of pairsInPage) {
      const key = `${pair.producer.nodeType}.${pair.producer.slotName} -> ${pair.consumer.nodeType}.${pair.consumer.slotName}`
      try {
        graph.clear()
        const producer = window.LiteGraph!.createNode(pair.producer.nodeType)
        const consumer = window.LiteGraph!.createNode(pair.consumer.nodeType)
        if (!producer || !consumer) {
          report.push({
            key,
            outcome: 'SLOT_CONTRACT_MISMATCH',
            detail: 'createNode returned null for a registered type'
          })
          continue
        }
        graph.add(producer)
        graph.add(consumer)
        const outIndex = producer.outputs.findIndex(
          (slot) => slot.name === pair.producer.slotName
        )
        const inIndex = consumer.inputs.findIndex(
          (slot) => slot.name === pair.consumer.slotName
        )
        if (outIndex < 0 || inIndex < 0) {
          // Pack JS may rebuild a declared input as widget-only (rgthree
          // Seed.seed) - excluded; missing as slot AND widget stays a fail.
          const widgetOnly =
            outIndex >= 0 &&
            (consumer.widgets ?? []).some(
              (widget) => widget.name === pair.consumer.slotName
            )
          report.push({
            key,
            outcome: widgetOnly
              ? 'WIDGET_ONLY_ON_INSTANCE'
              : 'SLOT_CONTRACT_MISMATCH',
            detail: `declared slot missing on instance (out=${outIndex}, in=${inIndex})`
          })
          continue
        }
        const link = producer.connect(outIndex, consumer, inIndex)
        if (!link || consumer.inputs[inIndex]?.link == null) {
          report.push({ key, outcome: 'CONNECT_REJECTED' })
          continue
        }
        const serialized = graph.serialize()
        graph.configure(serialized)
        const restored = graph.getNodeById(consumer.id)
        if (restored?.inputs?.[inIndex]?.link == null) {
          report.push({
            key,
            outcome: 'ROUNDTRIP_LOST',
            detail: 'serialize/configure dropped the link'
          })
          continue
        }
        const prompt = (await window.app!.graphToPrompt()) as {
          output?: Record<string, { inputs?: Record<string, unknown> }>
        }
        const promptInput =
          prompt.output?.[String(consumer.id)]?.inputs?.[pair.consumer.slotName]
        if (!Array.isArray(promptInput)) {
          report.push({
            key,
            outcome: 'ROUNDTRIP_LOST',
            detail: 'link missing from graphToPrompt output'
          })
          continue
        }
        report.push({ key, outcome: 'PASS' })
      } catch (error) {
        report.push({
          key,
          outcome: 'SLOT_CONTRACT_MISMATCH',
          detail: `threw: ${String(error)}`
        })
      }
    }
    graph.clear()
    return report
  }, pairs)
}

test('connectivity self-check: the executor rejects broken pairs @custom-nodes', async ({
  comfyPage
}) => {
  const slot = (nodeType: string, slotName: string, slotType: string) => ({
    nodeType,
    pack: 'core',
    slotName,
    slotType
  })
  const results = await runPairsInPage(comfyPage.page, [
    {
      producer: slot('CheckpointLoaderSimple', 'MODEL', 'MODEL'),
      consumer: slot('KSampler', 'latent_image', 'LATENT')
    },
    {
      producer: slot('EmptyLatentImage', 'LATENT', 'LATENT'),
      consumer: slot('KSampler', 'does_not_exist', 'LATENT')
    }
  ])
  expect(results.map((result) => result.outcome)).toEqual([
    'CONNECT_REJECTED',
    'SLOT_CONTRACT_MISMATCH'
  ])
})

test('connectivity drags: curated slot-to-slot wires connect under both renderers @custom-nodes', async ({
  comfyPage
}) => {
  test.setTimeout(120_000)
  const defs = (await comfyPage.page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const nodes = normalizeNodeDefs(defs)

  // Native anchor pair plus one in-pack, link-typed pair per connectivity
  // pack (derived from the same generator the breadth sweep uses).
  const dragEdges: PlannedPair[] = [
    {
      producer: {
        nodeType: 'EmptyLatentImage',
        pack: 'core',
        slotName: 'LATENT',
        slotType: 'LATENT'
      },
      consumer: {
        nodeType: 'KSampler',
        pack: 'core',
        slotName: 'latent_image',
        slotType: 'LATENT'
      }
    },
    // Second-slot anchor: ImageBatch has two IMAGE inputs (image1, image2)
    // and we target the SECOND. A slot hit-test regression that falls back
    // to the first compatible input would land on image1, leaving image2
    // (the asserted index) unlinked - so this pair, unlike a first-slot
    // pair, actually discriminates a broken drop-to-slot resolution.
    {
      producer: {
        nodeType: 'EmptyImage',
        pack: 'core',
        slotName: 'IMAGE',
        slotType: 'IMAGE'
      },
      consumer: {
        nodeType: 'ImageBatch',
        pack: 'core',
        slotName: 'image2',
        slotType: 'IMAGE'
      }
    }
  ]
  const nodeTypes = new Set(nodes.map((node) => node.type))
  for (const entry of connectivityEntries) {
    if (!isEntryInstalled(nodeTypes, entry)) {
      console.log(
        `connectivity drag: ${entry.pack} not installed on this backend`
      )
      continue
    }
    // Restrict the partner pool to the pack itself so the drag proves an
    // in-pack wiring; widget-backed primitive inputs render real slot dots
    // in Vue (verified empirically), so no slot type is excluded at plan time.
    const packPlan = planPairs(
      nodes.filter((node) => node.pack === entry.pack),
      entry.expectedNodes
    )
    expect(
      packPlan.pairs.length,
      `${entry.pack} has no in-pack draggable pair - drag coverage lost`
    ).toBeGreaterThan(0)
    // The plan comes from object_info, but a pack's own JS can rebuild a
    // declared input as widget-only on the instance (rgthree's Seed does).
    // Drag the first pair whose slots actually materialize; a pack whose
    // every planned pair is customized away has no socket contract to drag.
    const inPack = await firstMaterializedPair(comfyPage.page, packPlan.pairs)
    if (!inPack) {
      console.log(
        `connectivity drag: ${entry.pack} planned pairs are widget-only on instances; drag not applicable`
      )
      continue
    }
    dragEdges.push(inPack)
  }

  const vueIncompatiblePacks = new Set(
    connectivityEntries
      .filter((entry) => entry.vueNodesCompatible === false)
      .map((entry) => entry.pack)
  )
  for (const vueNodesEnabled of [false, true]) {
    const consoleErrors = collectConsoleErrors(comfyPage.page)
    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.Enabled',
      vueNodesEnabled
    )

    for (const edge of dragEdges) {
      if (vueNodesEnabled && vueIncompatiblePacks.has(edge.producer.pack)) {
        console.log(
          `connectivity drag: ${edge.producer.pack} declares vueNodesCompatible=false; Vue drag not applicable`
        )
        continue
      }
      await comfyPage.nodeOps.clearGraph()
      const producer = await comfyPage.nodeOps.addNode(
        edge.producer.nodeType,
        undefined,
        { x: 150, y: 200 }
      )
      const consumer = await comfyPage.nodeOps.addNode(
        edge.consumer.nodeType,
        undefined,
        { x: 700, y: 200 }
      )
      await comfyPage.nextFrame()

      const [outIndex, inIndex] = await comfyPage.page.evaluate(
        ([producerId, consumerId, outName, inName]) => {
          const byId = (id: string) =>
            window.app!.graph.nodes.find((node) => String(node.id) === id)!
          const src = byId(producerId)
          const dst = byId(consumerId)
          return [
            src.outputs.findIndex((slot) => slot.name === outName),
            dst.inputs.findIndex((slot) => slot.name === inName)
          ]
        },
        [
          String(producer.id),
          String(consumer.id),
          edge.producer.slotName,
          edge.consumer.slotName
        ] as const
      )
      const key = `${edge.producer.nodeType}.${edge.producer.slotName} -> ${edge.consumer.nodeType}.${edge.consumer.slotName}`
      expect(outIndex, `${key}: producer slot on instance`).toBeGreaterThan(-1)
      expect(inIndex, `${key}: consumer slot on instance`).toBeGreaterThan(-1)

      if (vueNodesEnabled) {
        await comfyPage.vueNodes.waitForNodes(2)
        // Slot-key-addressed dots so shared-label ambiguity cannot misfire
        // the drag.
        const outDot = comfyPage.vueNodes.getOutputSlotConnectionDot(
          String(producer.id),
          outIndex
        )
        const inDot = comfyPage.vueNodes.getInputSlotConnectionDot(
          String(consumer.id),
          inIndex
        )
        await outDot.dragTo(inDot)
      } else {
        await producer.connectOutput(outIndex, consumer, inIndex)
      }

      const linked = await comfyPage.page.evaluate(
        ([consumerId, index]) => {
          const node = window.app!.graph.nodes.find(
            (candidate) => String(candidate.id) === consumerId
          )
          return node?.inputs?.[Number(index)]?.link != null
        },
        [String(consumer.id), String(inIndex)] as const
      )
      expect(linked, `${key} with VueNodes=${vueNodesEnabled}`).toBe(true)
    }

    consoleErrors.stop()
    expect(
      consoleErrors.errors.filter((error) => !isForeignExecutionNoise(error)),
      `console errors with VueNodes=${vueNodesEnabled}`
    ).toEqual([])
    await expectNoVisibleErrors(
      comfyPage.page,
      `after drag pass VueNodes=${vueNodesEnabled}`
    )
  }
})
