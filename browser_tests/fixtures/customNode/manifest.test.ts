import { describe, expect, it } from 'vitest'
import type { CoreManifestEntry } from '@e2e/fixtures/customNode/manifest'
import {
  assertCloudManifestShape,
  assertCoreEntry,
  expectedNodeCountFor,
  loadApplicableAutogrowCases,
  loadFullManifest,
  loadManifest,
  servesFrontendAssetsForPack,
  shardOf
} from '@e2e/fixtures/customNode/manifest'

function validEntry(): CoreManifestEntry {
  return {
    pack: 'Example-Pack',
    repo: 'https://github.com/example/Example-Pack',
    pin: 'a1'.repeat(20),
    tiers: ['load', 'connectivity', 'run'],
    workflow: 'assets/customNodes/vhs_video_pipeline_run.json',
    expectedNodes: ['ExampleNode'],
    expectedRunnableCount: 1,
    expectedRunnableNodeTypesSha256: 'a'.repeat(64),
    expectedNodeCount: 1,
    expectedExtensions: ['Example.Extension'],
    requiresGpu: false,
    requiresModels: [],
    timeoutMs: 60_000
  }
}

describe('customNode manifest', () => {
  const cloudManifest = {
    source: {
      repository: 'https://github.com/Comfy-Org/cloud',
      ref: 'a'.repeat(40),
      path: 'comfy-complete/supported_nodes.yaml',
      importedAt: '2026-08-14'
    },
    coreDisabledNodes: {},
    packs: [
      {
        pack: 'example-pack',
        deployRef: 'example-pack@1.2.3',
        tiers: ['load', 'connectivity'],
        workflow: '',
        expectedNodes: ['ExampleNode'],
        expectedExtensions: [],
        expectedNodeCount: 1,
        timeoutMs: 60_000,
        disabledNodes: {}
      }
    ],
    unjoinedYamlPacks: []
  }

  it('constructs a canonical cloud manifest from unknown input', () => {
    expect(
      assertCloudManifestShape(
        {
          ...cloudManifest,
          ignored: true,
          source: { ...cloudManifest.source, ignored: true },
          packs: [{ ...cloudManifest.packs[0], ignored: true }]
        },
        'snapshot.json'
      )
    ).toEqual(cloudManifest)
  })

  it('rejects malformed nested cloud manifest fields', () => {
    expect(() =>
      assertCloudManifestShape(
        {
          ...cloudManifest,
          packs: [
            {
              ...cloudManifest.packs[0],
              disabledNodes: { ExampleNode: ['label', 42] }
            }
          ]
        },
        'snapshot.json'
      )
    ).toThrow(/malformed/)
  })

  it('loads entries with the shape the regression spec depends on', () => {
    const entries = loadFullManifest()
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.pack).toBeTruthy()
      expect(entry.expectedNodes.length).toBeGreaterThan(0)
      expect(entry.tiers.length).toBeGreaterThan(0)
    }
  })

  it('a local node-count baseline applies only to a local cloud-pack run', () => {
    const priorBackend = process.env.CUSTOM_NODES_BACKEND
    const priorManifest = process.env.CUSTOM_NODES_MANIFEST
    const entry = {
      ...validEntry(),
      pack: 'comfyui-videohelpersuite',
      expectedNodeCount: 32
    }
    try {
      process.env.CUSTOM_NODES_BACKEND = 'local'
      process.env.CUSTOM_NODES_MANIFEST = 'cloud'
      expect(expectedNodeCountFor(entry)).toBe(40)
      process.env.CUSTOM_NODES_BACKEND = 'cloud'
      expect(expectedNodeCountFor(entry)).toBe(32)
      process.env.CUSTOM_NODES_BACKEND = 'local'
      process.env.CUSTOM_NODES_MANIFEST = 'core'
      expect(expectedNodeCountFor(entry)).toBe(32)
    } finally {
      if (priorBackend === undefined) delete process.env.CUSTOM_NODES_BACKEND
      else process.env.CUSTOM_NODES_BACKEND = priorBackend
      if (priorManifest === undefined) delete process.env.CUSTOM_NODES_MANIFEST
      else process.env.CUSTOM_NODES_MANIFEST = priorManifest
    }
  })

  it('pin must be a full commit SHA', () => {
    expect(() => assertCoreEntry(validEntry(), 0)).not.toThrow()
    expect(() => assertCoreEntry({ ...validEntry(), workflow: '' }, 0)).toThrow(
      /workflow/
    )
    expect(() =>
      assertCoreEntry(
        {
          ...validEntry(),
          workflow: 'assets/customNodes/not_committed.json'
        },
        0
      )
    ).toThrow(/workflow/)
    expect(() => assertCoreEntry({ ...validEntry(), pin: '' }, 0)).toThrow(
      /pin/
    )
    expect(() =>
      assertCoreEntry({ ...validEntry(), pin: 'abc123' }, 0)
    ).toThrow(/pin/)
  })

  it('expectedExtensions is required; empty explicitly expects no healthy registration', () => {
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

  it('expectedNodeCount must be a positive integer', () => {
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

  it('run tiers require an exact nonzero runnable corpus', () => {
    const { expectedRunnableCount: _omitted, ...withoutField } = validEntry()
    expect(() => assertCoreEntry(withoutField as CoreManifestEntry, 0)).toThrow(
      /expectedRunnableCount/
    )
    for (const bad of [0, -1, 1.5, Number.NaN])
      expect(() =>
        assertCoreEntry({ ...validEntry(), expectedRunnableCount: bad }, 0)
      ).toThrow(/expectedRunnableCount/)
    expect(() =>
      assertCoreEntry(
        {
          ...validEntry(),
          tiers: ['load'],
          workflow: '',
          expectedRunnableCount: 1
        },
        0
      )
    ).toThrow(/expectedRunnableCount/)
    expect(() =>
      assertCoreEntry({ ...validEntry(), requiresGpu: true }, 0)
    ).toThrow(/model-free CPU gate/)
    expect(() =>
      assertCoreEntry(
        { ...validEntry(), requiresModels: ['model.safetensors'] },
        0
      )
    ).toThrow(/model-free CPU gate/)
  })

  it('run tiers require an exact runnable identity digest', () => {
    const { expectedRunnableNodeTypesSha256: _omitted, ...withoutField } =
      validEntry()
    expect(() => assertCoreEntry(withoutField as CoreManifestEntry, 0)).toThrow(
      /expectedRunnableNodeTypesSha256/
    )
    expect(() =>
      assertCoreEntry(
        { ...validEntry(), expectedRunnableNodeTypesSha256: 'not-a-digest' },
        0
      )
    ).toThrow(/expectedRunnableNodeTypesSha256/)
    expect(() =>
      assertCoreEntry(
        {
          ...validEntry(),
          tiers: ['load'],
          workflow: '',
          expectedRunnableCount: undefined,
          expectedRunnableNodeTypesSha256: 'a'.repeat(64)
        },
        0
      )
    ).toThrow(/expectedRunnableNodeTypesSha256/)
  })

  it('pack must be a plain path segment (it becomes the install dirname)', () => {
    for (const bad of ['../escape', 'a/b', '.hidden', 'sp ace', ''])
      expect(
        () => assertCoreEntry({ ...validEntry(), pack: bad }, 0),
        `pack '${bad}' must be rejected`
      ).toThrow(/pack/)
  })

  it('matches Impact frontend applicability to what the target serves', () => {
    const priorBackend = process.env.CUSTOM_NODES_BACKEND
    const priorManifest = process.env.CUSTOM_NODES_MANIFEST
    const expectedCase = {
      pack: 'ComfyUI-Impact-Pack',
      extensionName: 'Comfy.Impack',
      extensionPathPack: 'comfyui-impact-pack',
      consumerType: 'ImpactMakeImageList',
      producerType: 'EmptyImage',
      producerSlot: 'IMAGE'
    }
    try {
      process.env.CUSTOM_NODES_MANIFEST = 'core'
      process.env.CUSTOM_NODES_BACKEND = 'local'
      expect(
        loadApplicableAutogrowCases().map(({ autogrowCase }) => autogrowCase)
      ).toEqual([expectedCase])

      process.env.CUSTOM_NODES_MANIFEST = 'cloud'
      expect(
        loadApplicableAutogrowCases().map(({ autogrowCase }) => autogrowCase)
      ).toEqual([expectedCase])

      process.env.CUSTOM_NODES_BACKEND = 'cloud'
      expect(loadApplicableAutogrowCases()).toEqual([])
    } finally {
      if (priorBackend === undefined) delete process.env.CUSTOM_NODES_BACKEND
      else process.env.CUSTOM_NODES_BACKEND = priorBackend
      if (priorManifest === undefined) delete process.env.CUSTOM_NODES_MANIFEST
      else process.env.CUSTOM_NODES_MANIFEST = priorManifest
    }
    expect(
      servesFrontendAssetsForPack(
        ['/extensions/ComfyUI-Impact-Pack/js/impact.js'],
        'comfyui-impact-pack'
      )
    ).toBe(true)
    expect(
      servesFrontendAssetsForPack(
        ['/extensions/another-pack/main.js'],
        'comfyui-impact-pack'
      )
    ).toBe(false)
  })

  it('a pack keeps its shard when another pack is excluded', () => {
    // All packs in a shard share one Python environment, so a pack's
    // neighbours decide which of its optional imports resolve and how many
    // node classes it registers. Bin-packing the FILTERED list moved 26 of 81
    // packs when four left the quarantine, and every recorded node count moved
    // with them - calibration could never converge.
    const packs = Array.from({ length: 40 }, (_, i) => ({
      pack: `p${i}`,
      weight: (i % 7) + 1
    }))
    const original = process.env.CUSTOM_NODES_SHARD
    const shardIndexOf = (excluded: string[]) => {
      const dropped = new Set(excluded)
      const where = new Map<string, number>()
      for (let index = 1; index <= 4; index++) {
        process.env.CUSTOM_NODES_SHARD = `${index}/4`
        for (const entry of shardOf(packs, (e) => e.weight))
          if (!dropped.has(entry.pack)) where.set(entry.pack, index)
      }
      return where
    }
    try {
      const before = shardIndexOf([])
      const after = shardIndexOf(['p3', 'p11', 'p27'])
      const moved = [...after].filter(([pack, i]) => before.get(pack) !== i)
      expect(moved).toEqual([])
    } finally {
      if (original === undefined) delete process.env.CUSTOM_NODES_SHARD
      else process.env.CUSTOM_NODES_SHARD = original
    }
  })

  it('cloud local calibration rejects an unreviewed shard count', () => {
    const priorManifest = process.env.CUSTOM_NODES_MANIFEST
    const priorBackend = process.env.CUSTOM_NODES_BACKEND
    const priorShard = process.env.CUSTOM_NODES_SHARD
    try {
      process.env.CUSTOM_NODES_MANIFEST = 'cloud'
      process.env.CUSTOM_NODES_BACKEND = 'local'
      process.env.CUSTOM_NODES_SHARD = '1/4'
      expect(() => loadManifest()).toThrow(/calibrated for 5 shards, got 4/)
      process.env.CUSTOM_NODES_SHARD = '1/5'
      expect(() => loadManifest()).not.toThrow()
    } finally {
      if (priorManifest === undefined) delete process.env.CUSTOM_NODES_MANIFEST
      else process.env.CUSTOM_NODES_MANIFEST = priorManifest
      if (priorBackend === undefined) delete process.env.CUSTOM_NODES_BACKEND
      else process.env.CUSTOM_NODES_BACKEND = priorBackend
      if (priorShard === undefined) delete process.env.CUSTOM_NODES_SHARD
      else process.env.CUSTOM_NODES_SHARD = priorShard
    }
  })

  it('sharding balances by weight, not by count', () => {
    // The distribution that matters: expectedNodeCount runs 1..285 with a
    // median of 6, so equal pack counts are not equal work. Counting packs
    // per shard would pass on the 4.86x spread this replaced.
    // Heavy packs on a stride the old round-robin shared a residue with:
    // striping sent every one of them to the same shard (10.2x spread),
    // which is the real distribution this replaced.
    const heavy = Array.from({ length: 32 }, (_, i) => ({
      pack: `p${i}`,
      weight: i % 4 === 2 ? 250 : 5
    }))
    const original = process.env.CUSTOM_NODES_SHARD
    try {
      const loads: number[] = []
      for (let index = 1; index <= 4; index++) {
        process.env.CUSTOM_NODES_SHARD = `${index}/4`
        loads.push(
          shardOf(heavy, (entry) => entry.weight).reduce(
            (sum, entry) => sum + entry.weight,
            0
          )
        )
      }
      // Striping this fixture gives 50x; balanced divides exactly.
      expect(Math.max(...loads) / Math.min(...loads)).toBe(1)
    } finally {
      if (original === undefined) delete process.env.CUSTOM_NODES_SHARD
      else process.env.CUSTOM_NODES_SHARD = original
    }
  })

  it('sharding partitions the manifest - every pack exactly once', () => {
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

  it('an unshaped CUSTOM_NODES_SHARD fails rather than running everything', () => {
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
