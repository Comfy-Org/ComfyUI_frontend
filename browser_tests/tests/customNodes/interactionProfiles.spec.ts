import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { SYNTH_PRODUCERS } from '@e2e/fixtures/customNode/autoRun'
import type { NodeInteractionProfile } from '@e2e/fixtures/customNode/interactionProfiles'
import {
  INTERACTION_UNSTABLE_NODES,
  comparePackProfiles,
  hasCommittedProfile,
  loadPackProfiles,
  recordPackProfiles
} from '@e2e/fixtures/customNode/interactionProfiles'
import {
  customNodesManifest,
  loadManifest,
  packIdentity
} from '@e2e/fixtures/customNode/manifest'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import {
  isTypeCompatible,
  normalizeNodeDefs
} from '@e2e/fixtures/customNode/typePairing'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'

// S13: lock every registered node's interaction-triggered shape deltas.
// Probes are pure browser-side graph interactions (no prompt is ever
// queued), so this tier carries no backend-queue exclusivity constraint.
const PROBE_CHUNK = 40

test.use({ initialSettings: customNodeSuiteSettings })

interface ProbePlan {
  type: string
  // absent = the node declares no connectable inputs
  first?: { inputName: string; producer: string; producerOutput: number }
  last?: { inputName: string; producer: string; producerOutput: number }
}

function producerFor(
  inputType: string
): { producer: string; producerOutput: number } | null {
  const direct = SYNTH_PRODUCERS[inputType]
  if (direct)
    return { producer: direct.nodeType, producerOutput: direct.outputIndex }
  for (const [outType, synth] of Object.entries(SYNTH_PRODUCERS))
    if (isTypeCompatible(outType, inputType))
      return { producer: synth.nodeType, producerOutput: synth.outputIndex }
  return null
}

function planProbes(
  defs: Record<string, RawNodeDef>,
  pack: string
): ProbePlan[] {
  return normalizeNodeDefs(defs)
    .filter((node) => node.pack === pack)
    .map((node) => {
      const connectable = node.inputs
      const plan: ProbePlan = { type: node.type }
      const firstInput = connectable[0]
      const lastInput = connectable[connectable.length - 1]
      if (firstInput) {
        const producer = producerFor(firstInput.type)
        if (producer) plan.first = { inputName: firstInput.name, ...producer }
      }
      if (lastInput && lastInput !== firstInput) {
        const producer = producerFor(lastInput.type)
        if (producer) plan.last = { inputName: lastInput.name, ...producer }
      }
      return plan
    })
    .sort((a, b) => a.type.localeCompare(b.type))
}

test.beforeEach(({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

const interactionProfileEntries =
  customNodesManifest() === 'core'
    ? loadManifest().filter((row) =>
        hasCommittedProfile(row.pack, packIdentity(row))
      )
    : []

for (const entry of interactionProfileEntries) {
  test(`interaction profiles: ${entry.pack} @custom-nodes`, async ({
    comfyPage
  }) => {
    test.setTimeout(entry.timeoutMs + 120_000)
    const defs = (await comfyPage.page.evaluate(() =>
      window.app!.api.getNodeDefs()
    )) as unknown as Record<string, RawNodeDef>
    const plans = planProbes(defs, entry.pack)
    expect(
      plans.length,
      `${entry.pack} has a committed S13 profile but registered no nodes`
    ).toBeGreaterThan(0)

    const observed: Record<string, NodeInteractionProfile> = {}
    const probeThrows: Record<string, string> = {}
    for (let start = 0; start < plans.length; start += PROBE_CHUNK) {
      const chunk = plans.slice(start, start + PROBE_CHUNK)
      const probed = await comfyPage.page.evaluate((probePlans) => {
        // Shape entries are `kind:name:type`, sorted by the node-side diff;
        // capture reads the INSTANCE (what pack JS materialized), not the def.
        function shapeOf(node: {
          inputs?: Array<{ name: string; type: unknown }>
          outputs?: Array<{ name: string; type: unknown }>
          widgets?: Array<{ name?: string; type?: string }>
        }): { inputs: string[]; outputs: string[]; widgets: string[] } {
          return {
            inputs: (node.inputs ?? []).map(
              (slot) => `input:${slot.name}:${String(slot.type)}`
            ),
            outputs: (node.outputs ?? []).map(
              (slot) => `output:${slot.name}:${String(slot.type)}`
            ),
            widgets: (node.widgets ?? []).map(
              (widget) => `widget:${widget.name ?? '?'}:${widget.type ?? '?'}`
            )
          }
        }
        function diff(
          before: ReturnType<typeof shapeOf>,
          after: ReturnType<typeof shapeOf>
        ): string[] {
          const delta: string[] = []
          for (const facet of ['inputs', 'outputs', 'widgets'] as const) {
            const beforeSet = new Set(before[facet])
            const afterSet = new Set(after[facet])
            for (const item of afterSet)
              if (!beforeSet.has(item)) delta.push(`+${item}`)
            for (const item of beforeSet)
              if (!afterSet.has(item)) delta.push(`-${item}`)
          }
          return delta.sort()
        }
        const app = window.app!
        const graph = app.graph
        // Never reuse node ids within a page (widgetValueStore keys by id).
        window.__cnIdBase = Math.max(window.__cnIdBase ?? 0, graph.last_node_id)
        const results: Record<
          string,
          {
            connectFirst: string[] | 'NO_PRODUCER' | 'NO_INPUTS'
            connectLast:
              | string[]
              | 'NO_PRODUCER'
              | 'NO_INPUTS'
              | 'SAME_AS_FIRST'
            disconnect: string[] | 'NO_PRODUCER' | 'NO_INPUTS'
          }
        > = {}
        // One throwing node must not take its whole chunk with it: name it,
        // drop what it created, and probe the rest of the chunk anyway.
        const threw: Record<string, string> = {}
        for (const plan of probePlans) {
          const node = window.LiteGraph!.createNode(plan.type)
          if (!node) continue
          try {
            graph.last_node_id = ++window.__cnIdBase!
            graph.add(node)
            const fresh = shapeOf(node)
            const probeConnect = (spec: {
              inputName: string
              producer: string
              producerOutput: number
            }) => {
              const producerNode = window.LiteGraph!.createNode(spec.producer)
              if (!producerNode) return null
              try {
                graph.last_node_id = ++window.__cnIdBase!
                graph.add(producerNode)
                const inputIndex = (node.inputs ?? []).findIndex(
                  (slot: { name: string }) => slot.name === spec.inputName
                )
                if (inputIndex === -1) return null
                producerNode.connect(spec.producerOutput, node, inputIndex)
                const connected = shapeOf(node)
                node.disconnectInput(inputIndex)
                const disconnected = shapeOf(node)
                return { connected, disconnected }
              } finally {
                if (producerNode.graph) graph.remove(producerNode)
              }
            }
            const hasInputs = (node.inputs ?? []).length > 0
            if (!hasInputs) {
              results[plan.type] = {
                connectFirst: 'NO_INPUTS',
                connectLast: 'NO_INPUTS',
                disconnect: 'NO_INPUTS'
              }
            } else {
              const first = plan.first ? probeConnect(plan.first) : null
              const last = plan.last ? probeConnect(plan.last) : null
              const anchor = last ?? first
              results[plan.type] = {
                connectFirst: first
                  ? diff(fresh, first.connected)
                  : 'NO_PRODUCER',
                connectLast: plan.last
                  ? last
                    ? diff(fresh, last.connected)
                    : 'NO_PRODUCER'
                  : 'SAME_AS_FIRST',
                disconnect: anchor
                  ? diff(anchor.connected, anchor.disconnected)
                  : 'NO_PRODUCER'
              }
            }
          } catch (error) {
            threw[plan.type] = String(error)
          } finally {
            if (node.graph) graph.remove(node)
          }
        }
        return { results, threw }
      }, chunk)
      Object.assign(observed, probed.results)
      Object.assign(probeThrows, probed.threw)
    }
    // The probes queue nothing, so this returns without a round-trip; it stays
    // as the guard for pack JS that queues behind our back while being probed.
    expect(
      await drainBackendToIdle(comfyPage.page, 10_000),
      'interaction probe left test-owned backend work running'
    ).toBe(0)

    // Ahead of the ledger and profile gates: a node that threw is absent from
    // `observed`, which those would report as a stale baseline instead.
    expect(
      Object.entries(probeThrows).map(
        ([node, error]) => `${entry.pack}/${node}: probe threw: ${error}`
      ),
      'nodes that threw while being probed'
    ).toEqual([])

    for (const node of Object.keys(
      INTERACTION_UNSTABLE_NODES[entry.pack] ?? {}
    ))
      expect(
        node in observed,
        `${entry.pack}/${node} is ledgered unstable but no longer in the corpus - stale ledger entry`
      ).toBe(true)

    const recordMode = process.env.CN_INTERACTION
    if (recordMode !== undefined && recordMode !== 'record')
      throw new Error(
        `unrecognized CN_INTERACTION value '${recordMode}' - the only mode is 'record'`
      )
    if (recordMode === 'record') {
      recordPackProfiles(entry.pack, observed, {
        core: process.env.CN_INTERACTION_CORE ?? 'unpinned-local',
        pin: packIdentity(entry)
      })
      expect(
        null,
        `CN_INTERACTION=record: wrote ${Object.keys(observed).length} profile(s) for ${entry.pack} - the artifact is the product, this is not a pass`
      ).not.toBeNull()
    } else if (process.env.CI) {
      expect(
        comparePackProfiles({
          pack: entry.pack,
          observed,
          committed: loadPackProfiles(entry.pack)
        }),
        'S13 interaction profiles'
      ).toEqual([])
    } else {
      console.log(
        `S13 compare skipped off-CI for ${entry.pack} - baselines encode the pinned record environment; CI enforces`
      )
    }
  })
}
