import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { assertExecutionTier } from '@e2e/fixtures/customNode/allNodesExecutionTier'
import { assertMountTier } from '@e2e/fixtures/customNode/allNodesMountTier'
import { assertRoundtripTier } from '@e2e/fixtures/customNode/allNodesRoundtripTier'
import {
  ALL_NODES_TIER_CASES,
  ALL_NODES_MANIFEST_ENTRIES,
  INSTALLED_MANIFEST_PACKS,
  allNodesTierTimeout,
  entriesForAllNodesTier,
  packNodeKeysFromDefs,
  unmanifestedPackNames
} from '@e2e/fixtures/customNode/allNodesTier'
import { failureSummary } from '@e2e/fixtures/customNode/failureReport'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { attachPageDiagnosticEvidence } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  runWithCollectedCleanup,
  submittedPromptCount,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

test.afterEach(async ({ comfyPage }) => {
  expect(
    await drainBackendToIdle(comfyPage.page, 10_000),
    'test-owned backend work did not reach idle during cleanup'
  ).toBe(0)
})

test.describe('manifest covers every registered pack @custom-nodes', () => {
  test('no pack registers on the backend without a manifest row', async ({
    comfyPage
  }) => {
    const defs = (await comfyPage.page.evaluate(() =>
      window.app!.api.getNodeDefs()
    )) as unknown as Record<string, RawNodeDef>
    const uncovered = unmanifestedPackNames(defs, ALL_NODES_MANIFEST_ENTRIES)
    expect(
      uncovered,
      `backend registers pack(s) with no manifest row: ${uncovered.join(', ')} - they have ZERO coverage; add the manifest row`
    ).toEqual([])
  })
})

test.describe('all nodes by tier @custom-nodes', () => {
  for (const { tier, title } of ALL_NODES_TIER_CASES) {
    const tierEntries = entriesForAllNodesTier(ALL_NODES_MANIFEST_ENTRIES, tier)
    if (tierEntries.length === 0) continue

    test(`${tier}: ${title}`, async ({ comfyPage }) => {
      test.setTimeout(allNodesTierTimeout(tierEntries, tier))
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
      for (const entry of tierEntries) {
        let result = 'pass'
        try {
          const registeredKeys = packNodeKeysFromDefs(defs, entry.pack)
          expect(
            registeredKeys.length,
            `${entry.pack} not installed on this backend`
          ).toBeGreaterThan(0)
          await runWithCollectedCleanup(async () => {
            if (tier === 'S1' || tier === 'S2')
              await assertMountTier({
                comfyPage,
                entry,
                defs,
                registeredKeys,
                installedManifestPacks: INSTALLED_MANIFEST_PACKS,
                tier
              })
            else if (tier === 'S3')
              await assertRoundtripTier({
                comfyPage,
                entry,
                defs,
                registeredKeys,
                installedManifestPacks: INSTALLED_MANIFEST_PACKS
              })
            else
              await assertExecutionTier({
                comfyPage,
                entry,
                defs,
                registeredKeys
              })
          }, [
            () => comfyPage.nodeOps.clearGraph(),
            async () => {
              expect(
                await drainBackendToIdle(comfyPage.page, 10_000),
                `${entry.pack} left test-owned backend work running`
              ).toBe(0)
            }
          ])
        } catch (error) {
          result = 'fail'
          const errors =
            error instanceof AggregateError ? error.errors : [error]
          failures.push(
            `[${entry.pack}] ${errors
              .map((item) =>
                item instanceof Error ? item.message : String(item)
              )
              .join('\n')}`
          )
        }
        console.log(
          `[tier-pack] tier=${tier} pack=${entry.pack} result=${result}`
        )
      }
      if (tier !== 'S9')
        expect(
          await submittedPromptCount(comfyPage.page),
          `${tier} is a non-execution tier but submitted a prompt`
        ).toBe(0)
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
