import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'
import {
  assertCloudEntry,
  assertCloudManifestShape,
  assertCoreEntry,
  loadCloudCoreDisabledNodes,
  loadManifest,
  rendererPassesFor
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

function validCloudEntry(): CloudManifestEntry {
  return {
    pack: 'Example-Pack',
    deployRef: 'example-pack@1.2.3',
    tiers: ['load', 'connectivity'],
    workflow: '',
    expectedNodes: ['ExampleNode'],
    expectedNodeCount: 1,
    expectedExtensions: [],
    disabledNodes: {},
    timeoutMs: 30_000
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

  test('pin must be a full commit SHA; only the loader escape hatch admits an empty one', () => {
    // Deterministic regardless of ambient env: pin the var for the test,
    // restore the prior value.
    const prior = process.env.CUSTOM_NODES_ALLOW_UNPINNED
    delete process.env.CUSTOM_NODES_ALLOW_UNPINNED
    try {
      expect(() => assertCoreEntry(validEntry(), 0)).not.toThrow()
      // Run-enrolled rows must carry a workflow: this loader guard is what
      // lets T1 registration trust every registered row has one.
      expect(() =>
        assertCoreEntry({ ...validEntry(), workflow: '' }, 0)
      ).toThrow(/workflow/)
      expect(() =>
        assertCloudEntry({ ...validCloudEntry(), workflow: '' }, 0)
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

  test('expectedExtensions is required; empty only as an explicit no-frontend-JS declaration', () => {
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

  test('CUSTOM_NODES_ENV selects the manifest; unknown values and the missing cloud file fail loudly', () => {
    const prior = process.env.CUSTOM_NODES_ENV
    try {
      delete process.env.CUSTOM_NODES_ENV
      const defaulted = loadManifest()
      expect(defaulted.length).toBeGreaterThan(0)
      // Core envs carry no cloud core-node exclusions - the seeding input
      // is empty, never a file read that could throw.
      expect(loadCloudCoreDisabledNodes()).toEqual({})
      process.env.CUSTOM_NODES_ENV = 'core'
      expect(loadManifest()).toEqual(defaulted)
      expect(loadCloudCoreDisabledNodes()).toEqual({})
      // No cloud manifest is committed until the Phase-1 probe snapshot
      // exists, so selecting cloud must refuse to run - an empty manifest
      // here would generate zero tests and fake a green suite.
      process.env.CUSTOM_NODES_ENV = 'cloud'
      // PRE-CALIBRATION assertion: INVERT to a successful load in the same
      // commit that lands the generated customNodeManifest.cloud.json.
      expect(() => loadManifest()).toThrow(
        /customNodeManifest\.cloud\.json.*gen-cloud-manifest.*snapshot/s
      )
      // PRE-CALIBRATION assertion: INVERT alongside the loadManifest one
      // above when the generated manifest lands.
      expect(() => loadCloudCoreDisabledNodes()).toThrow(
        /customNodeManifest\.cloud\.json/
      )
      process.env.CUSTOM_NODES_ENV = 'clod'
      expect(() => loadManifest()).toThrow(/CUSTOM_NODES_ENV/)
    } finally {
      if (prior === undefined) delete process.env.CUSTOM_NODES_ENV
      else process.env.CUSTOM_NODES_ENV = prior
    }
  })

  test('deployRef admits both Cloud pin styles and nothing else', () => {
    expect(() => assertCloudEntry(validCloudEntry(), 0)).not.toThrow()
    const urlRef = `https://github.com/example/Example-Pack@${'a1'.repeat(20)}`
    expect(() =>
      assertCloudEntry({ ...validCloudEntry(), deployRef: urlRef }, 0)
    ).not.toThrow()
    for (const bad of [
      '',
      'example-pack',
      'https://github.com/example/Example-Pack',
      'https://github.com/example/Example-Pack@main',
      `@${'a1'.repeat(20)}`
    ])
      expect(
        () => assertCloudEntry({ ...validCloudEntry(), deployRef: bad }, 0),
        `deployRef '${bad}' must be rejected`
      ).toThrow(/deployRef/)
  })

  test('disabledNodes is required and every node carries its labels', () => {
    const { disabledNodes: _omitted, ...withoutField } = validCloudEntry()
    expect(() =>
      assertCloudEntry(withoutField as CloudManifestEntry, 0)
    ).toThrow(/disabledNodes/)
    expect(() =>
      assertCloudEntry(
        {
          ...validCloudEntry(),
          disabledNodes: { NodeA: ['ReadsArbitraryFile', 'WritesToDisk'] }
        },
        0
      )
    ).not.toThrow()
    for (const bad of [{ NodeA: [] }, { NodeA: [''] }, { NodeA: ['X', 'X'] }])
      expect(
        () => assertCloudEntry({ ...validCloudEntry(), disabledNodes: bad }, 0),
        `disabledNodes ${JSON.stringify(bad)} must be rejected`
      ).toThrow(/disabledNodes/)
  })

  test('assertCloudManifestShape names the source on malformed top-level shapes and returns valid ones', () => {
    const valid = {
      coreDisabledNodes: { VAESave: ['WritesToDisk'] },
      packs: [validCloudEntry()]
    }
    expect(assertCloudManifestShape(valid, 'probe.json')).toBe(valid)
    for (const bad of [
      null,
      42,
      'packs',
      [],
      { coreDisabledNodes: {}, packs: [] },
      { coreDisabledNodes: { NodeA: [] }, packs: [validCloudEntry()] },
      { packs: [validCloudEntry()] },
      { coreDisabledNodes: {}, packs: {} }
    ])
      expect(
        () => assertCloudManifestShape(bad, 'probe.json'),
        `${JSON.stringify(bad)} must be rejected`
      ).toThrow(/probe\.json is malformed/)
    // Pack rows still flow through assertCloudEntry, so a structurally sound
    // manifest with a broken row reds naming the row's field.
    expect(() =>
      assertCloudManifestShape(
        {
          coreDisabledNodes: {},
          packs: [{ ...validCloudEntry(), deployRef: 'unpinned' }]
        },
        'probe.json'
      )
    ).toThrow(/deployRef/)
  })
})
