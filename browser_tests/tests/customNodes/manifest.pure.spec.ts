import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { CustomNodeManifestEntry } from '@e2e/fixtures/customNode/manifest'
import {
  assertEntry,
  loadManifest,
  rendererPassesFor
} from '@e2e/fixtures/customNode/manifest'

function validEntry(): CustomNodeManifestEntry {
  return {
    pack: 'Example-Pack',
    repo: 'https://github.com/example/Example-Pack',
    pin: 'a1'.repeat(20),
    tiers: ['load', 'connectivity', 'run'],
    workflow: 'assets/customNodes/example_run.json',
    expectedNodes: ['ExampleNode'],
    expectedNodeCount: 1,
    expectedExtensions: ['Example.Extension'],
    requiresGpu: false,
    requiresModels: [],
    timeoutMs: 60_000
  }
}

test.describe('customNode manifest', () => {
  test('loads entries with the shape the regression spec depends on', () => {
    const entries = loadManifest()
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.pack).toBeTruthy()
      expect(entry.expectedNodes.length).toBeGreaterThan(0)
      expect(entry.tiers.length).toBeGreaterThan(0)
    }
  })

  test('rendererPassesFor drops only the Vue pass, only on an explicit false', () => {
    expect(rendererPassesFor({})).toEqual([false, true])
    expect(rendererPassesFor({ vueNodesCompatible: true })).toEqual([
      false,
      true
    ])
    expect(rendererPassesFor({ vueNodesCompatible: false })).toEqual([false])
  })

  test('pin must be a full commit SHA; only the canary override admits an empty one', () => {
    // Deterministic regardless of ambient env (a canary environment sets
    // the override): pin the var for the test, restore the prior value.
    const prior = process.env.CUSTOM_NODES_ALLOW_UNPINNED
    delete process.env.CUSTOM_NODES_ALLOW_UNPINNED
    try {
      expect(() => assertEntry(validEntry(), 0)).not.toThrow()
      expect(() => assertEntry({ ...validEntry(), pin: '' }, 0)).toThrow(/pin/)
      expect(() => assertEntry({ ...validEntry(), pin: 'abc123' }, 0)).toThrow(
        /pin/
      )
      process.env.CUSTOM_NODES_ALLOW_UNPINNED = '1'
      expect(() => assertEntry({ ...validEntry(), pin: '' }, 0)).not.toThrow()
      // the override admits only EMPTY pins; a malformed pin still fails
      expect(() => assertEntry({ ...validEntry(), pin: 'abc123' }, 0)).toThrow(
        /pin/
      )
    } finally {
      if (prior === undefined) delete process.env.CUSTOM_NODES_ALLOW_UNPINNED
      else process.env.CUSTOM_NODES_ALLOW_UNPINNED = prior
    }
  })

  test('expectedExtensions is required; empty only as an explicit no-frontend-JS declaration', () => {
    // Omission must fail (a new pack row cannot silently opt out of the
    // extension-loaded assert); an explicit [] is the deliberate opt-out.
    const { expectedExtensions: _omitted, ...withoutField } = validEntry()
    expect(() =>
      assertEntry(withoutField as CustomNodeManifestEntry, 0)
    ).toThrow(/expectedExtensions/)
    expect(() =>
      assertEntry({ ...validEntry(), expectedExtensions: [] }, 0)
    ).not.toThrow()
    expect(() =>
      assertEntry({ ...validEntry(), expectedExtensions: [''] }, 0)
    ).toThrow(/expectedExtensions/)
    expect(() =>
      assertEntry(
        { ...validEntry(), expectedExtensions: [42 as unknown as string] },
        0
      )
    ).toThrow(/expectedExtensions/)
    expect(() =>
      assertEntry({ ...validEntry(), expectedExtensions: ['A', 'A'] }, 0)
    ).toThrow(/expectedExtensions/)
  })

  test('expectedNodeCount must be a positive integer', () => {
    const { expectedNodeCount: _omitted, ...withoutField } = validEntry()
    expect(() =>
      assertEntry(withoutField as CustomNodeManifestEntry, 0)
    ).toThrow(/expectedNodeCount/)
    for (const bad of [0, -3, 1.5, Number.NaN]) {
      expect(() =>
        assertEntry({ ...validEntry(), expectedNodeCount: bad }, 0)
      ).toThrow(/expectedNodeCount/)
    }
    expect(() =>
      assertEntry({ ...validEntry(), expectedNodeCount: 197 }, 0)
    ).not.toThrow()
  })

  test('pack must be a plain path segment (it becomes the install dirname)', () => {
    for (const bad of ['../escape', 'a/b', '.hidden', 'sp ace', ''])
      expect(
        () => assertEntry({ ...validEntry(), pack: bad }, 0),
        `pack '${bad}' must be rejected`
      ).toThrow(/pack/)
  })
})
