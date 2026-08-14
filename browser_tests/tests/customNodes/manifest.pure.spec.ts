import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { CoreManifestEntry } from '@e2e/fixtures/customNode/manifest'
import {
  assertCoreEntry,
  loadApplicableAutogrowCases,
  loadFullManifest,
  rendererPassesFor,
  shardOf
} from '@e2e/fixtures/customNode/manifest'

function validEntry(): CoreManifestEntry {
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
    const entries = loadFullManifest()
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

  test('pin must be a full commit SHA; only the loader escape hatch admits an empty one', () => {
    // Deterministic regardless of ambient env: pin the var for the test,
    // restore the prior value.
    const prior = process.env.CUSTOM_NODES_ALLOW_UNPINNED
    delete process.env.CUSTOM_NODES_ALLOW_UNPINNED
    try {
      expect(() => assertCoreEntry(validEntry(), 0)).not.toThrow()
      expect(() =>
        assertCoreEntry({ ...validEntry(), workflow: '' }, 0)
      ).toThrow(/workflow/)
      expect(() => assertCoreEntry({ ...validEntry(), pin: '' }, 0)).toThrow(
        /pin/
      )
      expect(() =>
        assertCoreEntry({ ...validEntry(), pin: 'abc123' }, 0)
      ).toThrow(/pin/)
      process.env.CUSTOM_NODES_ALLOW_UNPINNED = '1'
      expect(() =>
        assertCoreEntry({ ...validEntry(), pin: '' }, 0)
      ).not.toThrow()
      // the override admits only EMPTY pins; a malformed pin still fails
      expect(() =>
        assertCoreEntry({ ...validEntry(), pin: 'abc123' }, 0)
      ).toThrow(/pin/)
    } finally {
      if (prior === undefined) delete process.env.CUSTOM_NODES_ALLOW_UNPINNED
      else process.env.CUSTOM_NODES_ALLOW_UNPINNED = prior
    }
  })

  test('expectedExtensions is required; empty explicitly expects no healthy registration', () => {
    // Omission must fail (a new pack row cannot silently opt out of the
    // extension-loaded assert); an explicit [] is the deliberate opt-out.
    const { expectedExtensions: _omitted, ...withoutField } = validEntry()
    expect(() => assertCoreEntry(withoutField as CoreManifestEntry, 0)).toThrow(
      /expectedExtensions/
    )
    expect(() =>
      assertCoreEntry({ ...validEntry(), expectedExtensions: [] }, 0)
    ).not.toThrow()
    expect(() =>
      assertCoreEntry({ ...validEntry(), expectedExtensions: [''] }, 0)
    ).toThrow(/expectedExtensions/)
    expect(() =>
      assertCoreEntry(
        { ...validEntry(), expectedExtensions: [42 as unknown as string] },
        0
      )
    ).toThrow(/expectedExtensions/)
    expect(() =>
      assertCoreEntry({ ...validEntry(), expectedExtensions: ['A', 'A'] }, 0)
    ).toThrow(/expectedExtensions/)
  })

  test('expectedNodeCount must be a positive integer', () => {
    const { expectedNodeCount: _omitted, ...withoutField } = validEntry()
    expect(() => assertCoreEntry(withoutField as CoreManifestEntry, 0)).toThrow(
      /expectedNodeCount/
    )
    for (const bad of [0, -3, 1.5, Number.NaN]) {
      expect(() =>
        assertCoreEntry({ ...validEntry(), expectedNodeCount: bad }, 0)
      ).toThrow(/expectedNodeCount/)
    }
    expect(() =>
      assertCoreEntry({ ...validEntry(), expectedNodeCount: 197 }, 0)
    ).not.toThrow()
  })

  test('pack must be a plain path segment (it becomes the install dirname)', () => {
    for (const bad of ['../escape', 'a/b', '.hidden', 'sp ace', ''])
      expect(
        () => assertCoreEntry({ ...validEntry(), pack: bad }, 0),
        `pack '${bad}' must be rejected`
      ).toThrow(/pack/)
  })

  test('matches Impact frontend applicability to what the target serves', () => {
    const impactExtensions = loadFullManifest().find(
      (entry) => entry.pack.toLowerCase() === 'comfyui-impact-pack'
    )?.expectedExtensions
    expect(impactExtensions).toContain('Comfy.Impack')
    expect(
      loadApplicableAutogrowCases().map(({ autogrowCase }) => autogrowCase)
    ).toEqual([
      {
        pack: 'ComfyUI-Impact-Pack',
        extensionName: 'Comfy.Impack',
        extensionPathPack: 'comfyui-impact-pack',
        consumerType: 'ImpactMakeImageList',
        producerType: 'EmptyImage',
        producerSlot: 'IMAGE'
      }
    ])
  })

  test('sharding partitions the manifest - every pack exactly once', () => {
    const packs = Array.from({ length: 87 }, (_, i) => `pack-${i}`)
    const original = process.env.CUSTOM_NODES_SHARD
    try {
      for (const total of [10, 14, 18]) {
        const seen: string[] = []
        for (let index = 1; index <= total; index++) {
          process.env.CUSTOM_NODES_SHARD = `${index}/${total}`
          seen.push(...shardOf(packs))
        }
        // Loss is the failure that matters: a pack dropped from every shard
        // reads as a smaller green run, not as missing coverage.
        expect(seen.slice().sort()).toEqual(packs.slice().sort())
      }
    } finally {
      if (original === undefined) delete process.env.CUSTOM_NODES_SHARD
      else process.env.CUSTOM_NODES_SHARD = original
    }
  })

  test('an unshaped CUSTOM_NODES_SHARD fails rather than running everything', () => {
    const original = process.env.CUSTOM_NODES_SHARD
    try {
      process.env.CUSTOM_NODES_SHARD = '11/10'
      expect(() => shardOf(['a'])).toThrow(/out of range/)
      process.env.CUSTOM_NODES_SHARD = 'half'
      expect(() => shardOf(['a'])).toThrow(/index\/total/)
    } finally {
      if (original === undefined) delete process.env.CUSTOM_NODES_SHARD
      else process.env.CUSTOM_NODES_SHARD = original
    }
  })
})
