import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeInteractionProfile } from '@e2e/fixtures/customNode/interactionProfiles'
import { SYNTH_PRODUCERS } from '@e2e/fixtures/customNode/autoRun'
import {
  INTERACTION_UNSTABLE_NODES,
  comparePackProfiles,
  loadPackProfiles,
  recordPackProfiles
} from '@e2e/fixtures/customNode/interactionProfiles'
import {
  INTERACTION_PROBE_CHUNK,
  planInteractionProbes,
  runInteractionProbeChunk
} from '@e2e/fixtures/customNode/interactionProbe'
import {
  customNodesManifest,
  loadManifest,
  packIdentity
} from '@e2e/fixtures/customNode/manifest'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  submittedPromptCount,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

const interactionProfileEntries =
  customNodesManifest() === 'core' ? loadManifest() : []

for (const entry of interactionProfileEntries) {
  test(`interaction profiles: ${entry.pack} @custom-nodes`, async ({
    comfyPage
  }) => {
    test.setTimeout(entry.timeoutMs + 120_000)
    const defs = (await comfyPage.page.evaluate(() =>
      window.app!.api.getNodeDefs()
    )) as unknown as Record<string, RawNodeDef>
    const plans = planInteractionProbes(defs, entry.pack)
    expect(
      plans.length,
      `${entry.pack} has a committed S13 profile but registered no nodes`
    ).toBeGreaterThan(0)

    const observed: Record<string, NodeInteractionProfile> = {}
    const created = new Set<string>()
    const probeThrows: Record<string, string> = {}
    for (
      let start = 0;
      start < plans.length;
      start += INTERACTION_PROBE_CHUNK
    ) {
      const probed = await comfyPage.page.evaluate(runInteractionProbeChunk, {
        probePlans: plans.slice(start, start + INTERACTION_PROBE_CHUNK),
        producers: SYNTH_PRODUCERS
      })
      for (const type of probed.created) created.add(type)
      Object.assign(observed, probed.results)
      Object.assign(probeThrows, probed.threw)
    }
    expect(
      plans.map(({ type }) => type).filter((type) => !created.has(type)),
      'planned S13 node types that did not instantiate'
    ).toEqual([])
    expect(
      await drainBackendToIdle(comfyPage.page, 10_000),
      'interaction probe left test-owned backend work running'
    ).toBe(0)
    expect(
      Object.entries(probeThrows).map(
        ([node, error]) => `${entry.pack}/${node}: probe threw: ${error}`
      ),
      'nodes that threw while being probed'
    ).toEqual([])
    expect(
      await submittedPromptCount(comfyPage.page),
      'interaction probe submitted a prompt'
    ).toBe(0)

    for (const node of Object.keys(
      INTERACTION_UNSTABLE_NODES[entry.pack] ?? {}
    ))
      expect(
        node in observed,
        `${entry.pack}/${node} is ledgered unstable but no longer in the corpus - stale ledger entry`
      ).toBe(true)

    const recordMode = process.env.CN_INTERACTION || undefined
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
          expectedPin: packIdentity(entry),
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
