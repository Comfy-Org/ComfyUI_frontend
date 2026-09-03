import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  runWithCollectedCleanup,
  submittedPromptCount,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'
import {
  isForeignExecutionNoise,
  staleRequiredConnectivityErrorRulesForPacks,
  unallowlistedConnectivityErrorsForPacks,
  unallowlistedErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import {
  connectivityExpectations,
  pairEndpointOwnershipIssues,
  pairExpectationKeys,
  pairExpectationNodeTypes
} from '@e2e/fixtures/customNode/connectivityExpectations'
import { failureSummary } from '@e2e/fixtures/customNode/failureReport'
import {
  loadAllManifestPackNames,
  loadFullManifest,
  loadManifest,
  packIdentity
} from '@e2e/fixtures/customNode/manifest'
import { eligibleNodeTypesForTier } from '@e2e/fixtures/customNode/tierNodeExclusions'
import type {
  ConnectivityOutcome,
  PlannedPair,
  RawNodeDef
} from '@e2e/fixtures/customNode/typePairing'
import {
  normalizeNodeDefs,
  planPairs
} from '@e2e/fixtures/customNode/typePairing'
import {
  attachPageDiagnosticEvidence,
  collectConsoleErrors
} from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

const PLAN_SETUP_MS = 120_000
const SWEEP_MS_PER_PAIR = 70
const ISOLATED_MS_PER_PAIR = PLAN_SETUP_MS
const DYNAMIC_CLEANUP_SETTLE_MS = 50
const PAIRS_PER_BATCH = 25
const BATCH_STALL_MS = 45_000
const PAIRS_PER_PAGE = 1_000
// Same discipline for the drag pass, whose edge list grows with every
// connectivity pack: one drag per edge per renderer. This test carried a flat
// 120s cap over today's 6 packs (16 drags) until the since-removed cloud
// surface uncapped it, so 15s per drag is that budget with margin.
const DRAG_MS_PER_DRAG = 15_000
const {
  isolatedNodeTypes,
  connectRejected: allConnectRejectedGroups,
  deterministicSlotContractMismatch: allDeterministicSlotContractMismatchGroups,
  dynamicSlotCleanupStalled: allDynamicSlotCleanupStalledGroups,
  roundtripLost: allRoundtripLostGroups,
  zeroPairDragExpectedNodeCounts
} = connectivityExpectations
const fullManifestPacks = new Set(
  loadFullManifest().map((entry) => entry.pack.toLowerCase())
)
const appliesToSelectedManifest = ({ pack }: { pack: string }) =>
  fullManifestPacks.has(pack.toLowerCase())
const connectRejectedGroups = allConnectRejectedGroups.filter(
  appliesToSelectedManifest
)
const deterministicSlotContractMismatchGroups =
  allDeterministicSlotContractMismatchGroups.filter(appliesToSelectedManifest)
const dynamicSlotCleanupStalledGroups =
  allDynamicSlotCleanupStalledGroups.filter(appliesToSelectedManifest)
const roundtripLostGroups = allRoundtripLostGroups.filter(
  appliesToSelectedManifest
)
const connectRejected = pairExpectationKeys(connectRejectedGroups)
const deterministicSlotContractMismatch = pairExpectationKeys(
  deterministicSlotContractMismatchGroups
)
const dynamicSlotCleanupStalled = pairExpectationKeys(
  dynamicSlotCleanupStalledGroups
)
const roundtripLost = pairExpectationKeys(roundtripLostGroups)
const requiredPairKeys = [
  ...connectRejected,
  ...deterministicSlotContractMismatch,
  ...dynamicSlotCleanupStalled,
  ...roundtripLost
]
const requiredEndpointNodeTypes = pairExpectationNodeTypes([
  ...connectRejectedGroups,
  ...deterministicSlotContractMismatchGroups,
  ...dynamicSlotCleanupStalledGroups,
  ...roundtripLostGroups
])

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

// This spec queues no prompt of its own, so the drain returns without a
// round-trip; it stays as the guard for pack JS that queues one behind our
// back, which would otherwise run on into the next test.
test.afterEach(async ({ comfyPage }) => {
  await runWithCollectedCleanup(async () => {
    expect(
      await submittedPromptCount(comfyPage.page),
      'connectivity probe submitted a prompt'
    ).toBe(0)
  }, [
    async () => {
      expect(
        await drainBackendToIdle(comfyPage.page, 10_000),
        'connectivity probe left test-owned backend work running'
      ).toBe(0)
    }
  ])
})

function isEntryInstalled(
  nodeTypes: Set<string>,
  entry: { expectedNodes: string[] }
): boolean {
  return entry.expectedNodes.every((type) => nodeTypes.has(type))
}

interface PairResult {
  key: string
  outcome: string
  detail?: string
}

async function runPairsInIsolatedPages(
  page: Page,
  pairs: PlannedPair[]
): Promise<{ results: PairResult[]; errors: string[] }> {
  const results: PairResult[] = []
  const errors: string[] = []
  for (const pair of pairs) {
    const pairKey = `${pair.producer.nodeType}.${pair.producer.slotName} -> ${pair.consumer.nodeType}.${pair.consumer.slotName}`
    const pairStart = Date.now()
    console.log(`connectivity isolated pair: ${pairKey} starting`)
    const probe = await page.context().newPage()
    try {
      await trackVisibleErrors(probe)
      await probe.goto(page.url())
      await probe.waitForFunction(
        ([producerType, consumerType]) =>
          window.app?.extensionManager !== undefined &&
          window.LiteGraph?.registered_node_types[producerType] !== undefined &&
          window.LiteGraph.registered_node_types[consumerType] !== undefined,
        [pair.producer.nodeType, pair.consumer.nodeType],
        { timeout: 60_000 }
      )
      await expectNoVisibleErrors(
        probe,
        `before isolated pair ${pair.producer.nodeType} -> ${pair.consumer.nodeType}`
      )
      const consoleErrors = collectConsoleErrors(probe)
      try {
        const pairResults = await evaluatePairs(probe, [pair], {
          resetAfter: false,
          stalledCleanupKeys: dynamicSlotCleanupStalled
        })
        results.push(...pairResults)
        await expectNoVisibleErrors(
          probe,
          `after isolated pair ${pair.producer.nodeType} -> ${pair.consumer.nodeType}`
        )
      } finally {
        consoleErrors.stop()
        errors.push(...consoleErrors.errors)
      }
    } finally {
      if (!probe.isClosed()) await probe.close()
      console.log(
        `connectivity isolated pair: ${pairKey} completed in ${Date.now() - pairStart}ms`
      )
    }
  }
  return { results, errors }
}

const connectivityEntries = loadManifest().filter((entry) =>
  entry.tiers.includes('connectivity')
)
const activeIsolatedNodeTypes = Object.fromEntries(
  Object.entries(isolatedNodeTypes).filter(([, isolation]) =>
    connectivityEntries.some((entry) => entry.pack === isolation.pack)
  )
)

test('connectivity: representative edges cover every enrolled pairable slot through model, serialize, and prompt conversion @custom-nodes', async ({
  comfyPage
}) => {
  test.setTimeout(PLAN_SETUP_MS)
  const defs = (await comfyPage.page.evaluate(() =>
    window.app!.api.getNodeDefs()
  )) as unknown as Record<string, RawNodeDef>
  const registeredNodes = normalizeNodeDefs(defs)
  for (const [nodeType, isolation] of Object.entries(activeIsolatedNodeTypes)) {
    const node = registeredNodes.find(
      (candidate) => candidate.type === nodeType
    )
    expect(
      node?.pack,
      `${nodeType} isolation is stale because the node is not registered`
    ).toBe(isolation.pack)
    console.log(`connectivity: isolating ${nodeType} - ${isolation.reason}`)
  }

  // Pack-specific expectations apply only where the pack is installed; on a
  // backend without it (e.g. a generic CI runner) the core sweep still runs
  // and the absence is reported, never fake-failed or fake-passed.
  const nodeTypes = new Set(registeredNodes.map((node) => node.type))
  const installedEntries = connectivityEntries.filter((entry) =>
    isEntryInstalled(nodeTypes, entry)
  )
  for (const entry of connectivityEntries)
    if (!installedEntries.includes(entry))
      console.log(`connectivity: ${entry.pack} not installed on this backend`)
  // Corpus = every node the installed packs register, from the live backend.
  const installedPacks = new Set(installedEntries.map((entry) => entry.pack))
  const eligibleTypesByPack = new Map(
    installedEntries.map((entry) => [
      entry.pack,
      new Set(
        eligibleNodeTypesForTier(
          { identity: packIdentity(entry), pack: entry.pack },
          'S4',
          registeredNodes
            .filter((node) => node.pack === entry.pack)
            .map((node) => node.type)
        )
      )
    ])
  )
  const nodes = registeredNodes.filter(
    (node) =>
      !installedPacks.has(node.pack) ||
      eligibleTypesByPack.get(node.pack)?.has(node.type)
  )
  const packTypes = nodes
    .filter((node) => installedPacks.has(node.pack))
    .map((node) => node.type)
  expect(
    pairEndpointOwnershipIssues(
      requiredEndpointNodeTypes,
      nodes,
      installedPacks
    ),
    'ledgered connectivity endpoint attribution'
  ).toEqual([])
  const knownNodeTypes = new Set([
    ...nodes.map((node) => node.type),
    ...requiredEndpointNodeTypes
  ])
  const plan = planPairs(nodes, packTypes, requiredPairKeys, knownNodeTypes)
  const isolatedTypes = new Set(Object.keys(activeIsolatedNodeTypes))
  const isolatedPairs = plan.pairs.filter(
    (pair) =>
      isolatedTypes.has(pair.producer.nodeType) ||
      isolatedTypes.has(pair.consumer.nodeType)
  )
  const sharedPairs = plan.pairs.filter(
    (pair) =>
      !isolatedTypes.has(pair.producer.nodeType) &&
      !isolatedTypes.has(pair.consumer.nodeType)
  )

  expect(plan.pairs.length, 'pairing produced no edges').toBeGreaterThan(0)
  expect(
    plan.unknownShapes,
    'installed-pack slots with unrecognized object_info shapes'
  ).toEqual([])
  expect(
    plan.requiredPairIssues,
    'ledgered connectivity pair can no longer be planned exactly'
  ).toEqual([])
  for (const nodeType of isolatedTypes)
    expect(
      isolatedPairs.some(
        (pair) =>
          pair.producer.nodeType === nodeType ||
          pair.consumer.nodeType === nodeType
      ),
      `${nodeType} has no isolated pairs - remove its stale isolation entry`
    ).toBe(true)
  console.log(
    `connectivity plan: ${plan.pairs.length} pairs (${isolatedPairs.length} isolated), ${plan.orphans.length} orphan slots, ${plan.wildcards.length} wildcard + ${plan.combos.length} combo slots (excluded by design), ${plan.unknownShapes.length} unknown-shape slots (recorded: ${plan.unknownShapes.join('; ') || 'none'})`
  )

  for (const entry of installedEntries) {
    const contributes = plan.pairs.some(
      (pair) =>
        pair.producer.pack === entry.pack || pair.consumer.pack === entry.pack
    )
    expect(
      contributes,
      `${entry.pack} contributes no pairs - corpus or pack attribution broke`
    ).toBe(true)
  }

  // The breadth sweep runs under one renderer by design: it exercises
  // graph-API link creation, the real isValidConnection veto, and
  // serialize/configure survival - all renderer-independent paths (widget
  // values and links flow through the same stores in both renderers). The
  // curated drag test below covers real pointer wiring under BOTH renderers.
  test.setTimeout(
    PLAN_SETUP_MS +
      sharedPairs.length * SWEEP_MS_PER_PAIR +
      isolatedPairs.length * ISOLATED_MS_PER_PAIR
  )
  const sweepStart = Date.now()
  const sharedStart = Date.now()
  const shared = await runPairsAcrossPages(comfyPage, sharedPairs)
  console.log(
    `connectivity shared sweep: ${sharedPairs.length} pairs in ${Date.now() - sharedStart}ms`
  )
  const isolated = await runPairsInIsolatedPages(comfyPage.page, isolatedPairs)
  const results = [...shared.results, ...isolated.results]
  const sweepMs = Date.now() - sweepStart
  expect(
    results,
    'the executor must return one outcome for every planned pair'
  ).toHaveLength(plan.pairs.length)
  console.log(
    `connectivity sweep: ${plan.pairs.length} pairs in ${sweepMs}ms (${(sweepMs / plan.pairs.length).toFixed(1)}ms/pair)`
  )
  const failures = results.filter(
    (result) =>
      result.outcome !== ('PASS' satisfies ConnectivityOutcome) &&
      !(
        result.outcome === ('CONNECT_REJECTED' satisfies ConnectivityOutcome) &&
        connectRejected.includes(result.key)
      ) &&
      !(
        result.outcome ===
          ('DYNAMIC_SLOT_CLEANUP_STALLED' satisfies ConnectivityOutcome) &&
        dynamicSlotCleanupStalled.includes(result.key)
      ) &&
      !(
        result.outcome === ('ROUNDTRIP_LOST' satisfies ConnectivityOutcome) &&
        roundtripLost.includes(result.key)
      ) &&
      !(
        result.outcome ===
          ('SLOT_CONTRACT_MISMATCH' satisfies ConnectivityOutcome) &&
        deterministicSlotContractMismatch.includes(result.key)
      )
  )
  const passed = results.filter((result) => result.outcome === 'PASS').length
  console.log(`connectivity sweep: ${passed}/${results.length} pairs PASS`)
  // Ahead of the console gate below so the tier's own outcome signal is the
  // failure message, not console noise a pack emitted alongside it.
  expect(failures, JSON.stringify(failures, null, 1)).toEqual([])
  expect(passed).toBeGreaterThan(0)

  // Routed through the pack console ledger scoped to the packs actually in
  // the corpus (the escape hatch this assert always documented): a KJNodes
  // SplineEditor creation crash fired on 2026-07-18 when core's new partner
  // nodes reshuffled the pair plan, and the ledger row carries its mechanism
  // and upstream-report status. Every non-ledgered error still fails. The
  // wiring sweep queues no prompts, so a prompt-execution error here is a
  // prior tier's async stray, not this test's (isForeignExecutionNoise;
  // ARCHITECTURE section 9 principle).
  const sweepErrors = [...shared.errors, ...isolated.errors].filter(
    (error) => !isForeignExecutionNoise(error)
  )
  const unledgered = unallowlistedConnectivityErrorsForPacks(
    [...installedPacks],
    sweepErrors
  )
  if (sweepErrors.length > unledgered.length)
    console.log(
      `connectivity sweep: ${sweepErrors.length - unledgered.length} console error(s) matched an installed pack's allowlist`
    )
  if (unledgered.length > 0)
    await attachPageDiagnosticEvidence(
      test.info(),
      'connectivity-console-errors.json',
      unledgered
    )
  expect(
    unledgered.length === 0,
    failureSummary(
      'console errors during breadth sweep',
      unledgered,
      'connectivity-console-errors.json'
    )
  ).toBe(true)
  expect(
    staleRequiredConnectivityErrorRulesForPacks(
      [...installedPacks],
      sweepErrors
    ),
    'stale required connectivity console mechanisms'
  ).toEqual([])

  // Two-way guard, same discipline as cannotRunAlone, for these expectations
  // in the loop below: every key must still be OBSERVED failing in its
  // recorded way. An entry whose pair now passes (or is no longer even
  // planned) is stale and would silently hide the fixed bug behind it.
  const outcomeByKey = new Map(
    results.map((result) => [result.key, result.outcome])
  )
  // The expectations are global; a shard installs one slice of the manifest. Asking
  // "are all packs installed" answers that for the SLICE, so it went true and
  // every entry naming a node from another shard read as stale - 13 of them on
  // run 31861114255. A shard can only speak to keys whose node types it
  // actually has. Node types contain dots (MathExpression|pysssss.expression),
  // so the slot name is split from the right.
  const liveNodeTypes = new Set(nodes.map((node) => node.type))
  const keyIsAnswerable = (key: string): boolean | null => {
    const sides = key.split(' -> ')
    if (sides.length !== 2) return null
    const nodeTypes = sides.map((side) => {
      const separator = side.lastIndexOf('.')
      return separator > 0 && separator < side.length - 1
        ? side.slice(0, separator)
        : null
    })
    if (nodeTypes.some((nodeType) => nodeType === null)) return null
    return nodeTypes.every(
      (nodeType) => nodeType !== null && liveNodeTypes.has(nodeType)
    )
  }
  const staleEntries: string[] = []
  for (const [expectedPairs, expectedOutcome] of [
    [connectRejected, 'CONNECT_REJECTED'],
    [dynamicSlotCleanupStalled, 'DYNAMIC_SLOT_CLEANUP_STALLED'],
    [roundtripLost, 'ROUNDTRIP_LOST'],
    [deterministicSlotContractMismatch, 'SLOT_CONTRACT_MISMATCH']
  ] as const)
    for (const key of expectedPairs) {
      const observed = outcomeByKey.get(key)
      const answerable = keyIsAnswerable(key)
      if (answerable === null) {
        staleEntries.push(`${key}: invalid pair key`)
        continue
      }
      if (!answerable) continue
      if (observed !== expectedOutcome)
        staleEntries.push(
          `${key}: expected ${expectedOutcome}, observed ${observed ?? 'nothing'} - remove the stale entry`
        )
    }
  expect(staleEntries, 'stale connectivity expectations').toEqual([])
  await expectNoVisibleErrors(comfyPage.page, 'after breadth sweep')
})

// First planned pair whose slots both exist on real instances (pack JS can
// rebuild declared inputs as widget-only controls).
function firstMaterializedPair(
  page: Page,
  pairs: PlannedPair[]
): Promise<PlannedPair | null> {
  return page.evaluate(async (pairsInPage) => {
    const graph = window.app!.graph
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    for (const pair of pairsInPage) {
      graph.clear()
      try {
        const producer = window.LiteGraph!.createNode(pair.producer.nodeType)
        const consumer = window.LiteGraph!.createNode(pair.consumer.nodeType)
        if (!producer || !consumer) continue
        graph.add(producer)
        graph.add(consumer)
        await settle()
        const outFound = producer.outputs.some(
          (slot) => slot.name === pair.producer.slotName
        )
        const inFound = consumer.inputs.some(
          (slot) => slot.name === pair.consumer.slotName
        )
        if (outFound && inFound) return pair
      } finally {
        graph.clear()
        await settle()
      }
    }
    return null
  }, pairs)
}

// The self-check below runs THIS SAME executor on poisoned pairs; if it stops
// being able to reject, every green sweep above is meaningless.
async function runPairsInPage(
  page: Page,
  pairs: PlannedPair[]
): Promise<PairResult[]> {
  const results: PairResult[] = []
  for (let start = 0; start < pairs.length; start += PAIRS_PER_BATCH) {
    const batch = pairs.slice(start, start + PAIRS_PER_BATCH)
    const firstKey = `${batch[0].producer.nodeType}.${batch[0].producer.slotName}`
    console.log(
      `connectivity shared batch: ${start + 1}-${start + batch.length}/${pairs.length} starting at ${firstKey}`
    )
    results.push(...(await evaluatePairs(page, batch)))
  }
  return results
}

async function runPairsAcrossPages(
  comfyPage: ComfyPage,
  pairs: PlannedPair[]
): Promise<{ results: PairResult[]; errors: string[] }> {
  const results: PairResult[] = []
  const errors: string[] = []
  for (let start = 0; start < pairs.length; start += PAIRS_PER_PAGE) {
    if (start > 0) {
      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.waitForAppReady()
    }
    const pagePairs = pairs.slice(start, start + PAIRS_PER_PAGE)
    console.log(
      `connectivity shared page: ${start + 1}-${start + pagePairs.length}/${pairs.length}`
    )
    const consoleErrors = collectConsoleErrors(comfyPage.page)
    try {
      results.push(...(await runPairsInPage(comfyPage.page, pagePairs)))
    } finally {
      consoleErrors.stop()
      errors.push(...consoleErrors.errors)
    }
  }
  return { results, errors }
}

async function evaluatePairs(
  page: Page,
  pairs: PlannedPair[],
  options: { resetAfter?: boolean; stalledCleanupKeys?: string[] } = {}
): Promise<PairResult[]> {
  const stall = Symbol('stall')
  let timerId: ReturnType<typeof setTimeout> | undefined
  const timer = new Promise<typeof stall>((resolve) => {
    timerId = setTimeout(() => resolve(stall), BATCH_STALL_MS)
  })
  const batch = evaluatePairsInPage(page, pairs, options)
  let outcome: PairResult[] | typeof stall
  try {
    outcome = await Promise.race([batch, timer])
  } finally {
    if (timerId !== undefined) clearTimeout(timerId)
  }
  if (outcome !== stall) return outcome
  const probe = async () =>
    page
      .evaluate(
        () => (window as unknown as { __cnPairCursor?: string }).__cnPairCursor,
        { timeout: 10_000 }
      )
      .catch(() => null)
  const first = await probe()
  await new Promise((resolve) => setTimeout(resolve, 2_000))
  const second = await probe()
  if (first === null || second === null)
    throw new Error(
      `connectivity batch wedged the renderer after ${BATCH_STALL_MS}ms; the page stopped answering, so a pack ran a synchronous loop. Batch started at ${pairs[0] ? `${pairs[0].producer.nodeType}.${pairs[0].producer.slotName}` : 'unknown'}`
    )
  const advanced = first !== second
  throw new Error(
    advanced
      ? `connectivity batch is progressing but too slow for ${BATCH_STALL_MS}ms: the cursor moved '${first}' -> '${second}' during a 2s sample, so no single pair is stuck and the batch simply needs longer than the budget allows`
      : `connectivity batch stalled after ${BATCH_STALL_MS}ms on pair '${second ?? 'none recorded'}' - the page answers and the cursor did not move across a 2s sample, so that one pair is awaiting something that never settles`
  )
}

function evaluatePairsInPage(
  page: Page,
  pairs: PlannedPair[],
  {
    resetAfter = true,
    stalledCleanupKeys = []
  }: { resetAfter?: boolean; stalledCleanupKeys?: string[] } = {}
): Promise<PairResult[]> {
  const payload = [
    pairs,
    resetAfter,
    stalledCleanupKeys,
    DYNAMIC_CLEANUP_SETTLE_MS
  ] as const
  return page.evaluate(async (payloadInPage) => {
    const [pairsInPage, resetAfter, stalledKeys, cleanupSettleMs] =
      payloadInPage
    const graph = window.app!.graph
    let nextNodeId = graph.last_node_id
    const resetGraph = () => {
      nextNodeId = graph.last_node_id
      graph.clear()
      graph.last_node_id = nextNodeId
    }
    const report: Array<{
      key: string
      outcome: string
      detail?: string
    }> = []
    for (const pair of pairsInPage) {
      const key = `${pair.producer.nodeType}.${pair.producer.slotName} -> ${pair.consumer.nodeType}.${pair.consumer.slotName}`
      Object.assign(window, { __cnPairCursor: key })
      try {
        resetGraph()
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
        let stalledCleanup: string | undefined
        if (stalledKeys.includes(key)) {
          const removeInput = consumer.removeInput.bind(consumer)
          let priorNoProgress:
            | { slotIndex: number; inputCount: number }
            | undefined
          consumer.removeInput = (slotIndex) => {
            const inputCount = consumer.inputs.length
            const removed = removeInput(slotIndex)
            if (consumer.inputs.length !== inputCount) {
              priorNoProgress = undefined
              return removed
            }
            if (
              priorNoProgress?.slotIndex === slotIndex &&
              priorNoProgress.inputCount === inputCount
            ) {
              stalledCleanup = `removeInput(${slotIndex}) left ${inputCount} inputs unchanged on consecutive cleanup iterations`
              const unlinkedIndex = consumer.inputs.findIndex(
                (input) => input.link == null
              )
              if (unlinkedIndex >= 0) removeInput(unlinkedIndex)
              priorNoProgress = undefined
              return removed
            }
            priorNoProgress = { slotIndex, inputCount }
            return removed
          }
        }
        // Pack nodeCreated hooks commonly defer widget/editor initialization
        // with setTimeout(0). Let that required mount work finish before this
        // sweep serializes the pair. Without the yield, a 1,000-pair browser
        // task snapshots half-initialized nodes and accumulates their deferred
        // WebGL/editor work until after the batch has already removed them.
        await new Promise((resolve) => setTimeout(resolve, 0))
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
        if (stalledKeys.includes(key)) {
          await new Promise((resolve) => setTimeout(resolve, cleanupSettleMs))
          if (stalledCleanup !== undefined) {
            report.push({
              key,
              outcome: 'DYNAMIC_SLOT_CLEANUP_STALLED',
              detail: stalledCleanup
            })
            continue
          }
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
        let prompt: {
          output?: Record<string, { inputs?: Record<string, unknown> }>
        }
        try {
          prompt = (await window.app!.graphToPrompt()) as typeof prompt
        } catch (error) {
          const detail = String(error)
          if (
            detail.startsWith('InvalidLinkError: No input node found for id')
          ) {
            report.push({
              key,
              outcome: 'ROUNDTRIP_LOST',
              detail: `graphToPrompt rejected a restored dangling link: ${detail}`
            })
            continue
          }
          throw error
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
          outcome: 'THREW',
          detail: `threw: ${String(error)}`
        })
      }
    }
    if (resetAfter) resetGraph()
    return report
  }, payload)
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

test('connectivity drags: one materialized in-pack link per applicable pack connects under both renderers @custom-nodes', async ({
  comfyPage
}) => {
  test.setTimeout(PLAN_SETUP_MS)
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
  const observedZeroPairPacks = new Set<string>()
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
    const registeredPackNodes = nodes.filter((node) => node.pack === entry.pack)
    const eligiblePackNodeTypes = new Set(
      eligibleNodeTypesForTier(
        { identity: packIdentity(entry), pack: entry.pack },
        'S5',
        registeredPackNodes.map((node) => node.type)
      )
    )
    const packNodes = registeredPackNodes.filter((node) =>
      eligiblePackNodeTypes.has(node.type)
    )
    const packPlan = planPairs(packNodes, entry.expectedNodes)
    if (packPlan.pairs.length === 0) {
      expect(
        zeroPairDragExpectedNodeCounts[entry.pack],
        `${entry.pack} registers ${packNodes.length} nodes but contributes no in-pack draggable pair - drag coverage lost`
      ).toBe(packNodes.length)
      observedZeroPairPacks.add(entry.pack)
      console.log(
        `connectivity drag: ${entry.pack} is the verified ${packNodes.length}-node pack with no self-pair; S4 cross-pack coverage applies, S5 in-pack drag is not applicable`
      )
      continue
    }
    // The plan comes from object_info, but a pack's own JS can rebuild a
    // declared input as widget-only on the instance (rgthree's Seed does).
    // Drag the first pair whose slots actually materialize; a pack whose
    // every planned pair is customized away has no socket contract to drag.
    const inPack = await firstMaterializedPair(comfyPage.page, packPlan.pairs)
    if (!inPack)
      throw new Error(
        `${entry.pack} has planned pairs but every declared socket is widget-only on instances - add an exact reviewed applicability expectation`
      )
    dragEdges.push(inPack)
  }
  for (const pack of Object.keys(zeroPairDragExpectedNodeCounts)) {
    // Existence is a manifest-wide fact; whether this shard owns the pack is
    // a separate question. Checking both against the slice made every shard
    // that does not own a listed pack report it as stale.
    expect(
      loadAllManifestPackNames().includes(pack),
      `${pack} has a zero-pair expectation but is not a manifest entry`
    ).toBe(true)
    const entry = connectivityEntries.find((entry) => entry.pack === pack)
    if (!entry || !isEntryInstalled(nodeTypes, entry)) continue
    expect(
      observedZeroPairPacks.has(entry.pack),
      `${pack} now contributes an in-pack draggable pair - remove the stale zero-pair expectation`
    ).toBe(true)
  }

  const rendererPasses = [false, true]
  test.setTimeout(
    PLAN_SETUP_MS + dragEdges.length * rendererPasses.length * DRAG_MS_PER_DRAG
  )
  for (const vueNodesEnabled of rendererPasses) {
    const consoleErrors = collectConsoleErrors(comfyPage.page)
    await comfyPage.settings.setSetting(
      'Comfy.VueNodes.Enabled',
      vueNodesEnabled
    )

    for (const edge of dragEdges) {
      await comfyPage.nodeOps.clearGraph()
      const producer = await comfyPage.nodeOps.addNode(
        edge.producer.nodeType,
        undefined,
        { x: 150, y: 200 }
      )
      await comfyPage.nextFrame()
      const producerWidth = (await producer.getSize()).width
      const consumer = await comfyPage.nodeOps.addNode(
        edge.consumer.nodeType,
        undefined,
        { x: 150 + producerWidth + 150, y: 200 }
      )
      await comfyPage.nextFrame()
      await fitToViewInstant(comfyPage)

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

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(
              ([consumerId, index]) => {
                const node = window.app!.graph.nodes.find(
                  (candidate) => String(candidate.id) === consumerId
                )
                return node?.inputs?.[Number(index)]?.link != null
              },
              [String(consumer.id), String(inIndex)] as const
            ),
          { message: `${key} with VueNodes=${vueNodesEnabled}` }
        )
        .toBe(true)
    }

    consoleErrors.stop()
    const dragPacks = [
      ...new Set(
        dragEdges.flatMap((edge) => [edge.producer.pack, edge.consumer.pack])
      )
    ]
    const dragErrors = consoleErrors.errors.filter(
      (error) => !isForeignExecutionNoise(error)
    )
    const unledgered = unallowlistedErrorsForPacks(dragPacks, dragErrors)
    if (dragErrors.length > unledgered.length)
      console.log(
        `connectivity drag: ${dragErrors.length - unledgered.length} console error(s) matched the exact environment or installed-pack ledger`
      )
    if (unledgered.length > 0)
      await attachPageDiagnosticEvidence(
        test.info(),
        'connectivity-drag-console-errors.json',
        unledgered
      )
    expect(
      unledgered.length === 0,
      failureSummary(
        `console errors with VueNodes=${vueNodesEnabled}`,
        unledgered,
        'connectivity-drag-console-errors.json'
      )
    ).toBe(true)
    await expectNoVisibleErrors(
      comfyPage.page,
      `after drag pass VueNodes=${vueNodesEnabled}`
    )
  }
})
