import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  cloudAutoRunExclusions,
  disabledHarnessNodes,
  stalenessCheckedKeys
} from '@e2e/fixtures/customNode/cloudExclusions'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'

function coreEntry(pack = 'Example-Pack'): CoreManifestEntry {
  return {
    pack,
    repo: 'https://github.com/example/Example-Pack',
    pin: 'a1'.repeat(20),
    tiers: ['load'],
    workflow: '',
    expectedNodes: ['ExampleNode'],
    expectedNodeCount: 1,
    expectedExtensions: [],
    requiresGpu: false,
    requiresModels: [],
    timeoutMs: 30_000
  }
}

function cloudEntry(
  disabledNodes: Record<string, string[]> = {},
  pack = 'Example-Pack'
): CloudManifestEntry {
  return {
    pack,
    deployRef: 'example-pack@1.2.3',
    tiers: ['load'],
    workflow: '',
    expectedNodes: ['ExampleNode'],
    expectedNodeCount: 1,
    expectedExtensions: [],
    disabledNodes,
    timeoutMs: 30_000
  }
}

test.describe('cloudAutoRunExclusions', () => {
  test('core entries and undisabled cloud entries seed nothing', () => {
    expect(cloudAutoRunExclusions(coreEntry())).toEqual({})
    expect(cloudAutoRunExclusions(cloudEntry())).toEqual({})
    expect(cloudAutoRunExclusions(cloudEntry(), 'register-but-block')).toEqual(
      {}
    )
  })

  test('the default vanish reading excludes nothing: disabled nodes never register and the generator already subtracted them from the counts', () => {
    expect(
      cloudAutoRunExclusions(
        cloudEntry({ NodeA: ['ReadsArbitraryFile', 'WritesToDisk'] })
      )
    ).toEqual({})
  })

  test('register-but-block is a loud not-yet-calibrated stub, not a guess', () => {
    expect(() =>
      cloudAutoRunExclusions(
        cloudEntry({ NodeA: ['ReadsArbitraryFile'], NodeB: ['Stateful'] }),
        'register-but-block'
      )
    ).toThrow(/not calibrated.*Phase-1 probe.*2.*label-disabled/s)
  })
})

// The staleness guards read their keys through this filter, so a degradation
// to "always empty" would silently retire every stale-ledger assert.
test.describe('stalenessCheckedKeys', () => {
  const ledger = { NodeA: 'why', NodeB: 'why' }

  test('checks every ledgered key when the env disables none of them', () => {
    expect(stalenessCheckedKeys(coreEntry(), ledger)).toEqual([
      'NodeA',
      'NodeB'
    ])
    expect(stalenessCheckedKeys(cloudEntry(), ledger)).toEqual([
      'NodeA',
      'NodeB'
    ])
  })

  test('skips a key the env label-disables: it vanishes by design, it is not stale', () => {
    expect(
      stalenessCheckedKeys(cloudEntry({ NodeA: ['DisabledOnCloud'] }), ledger)
    ).toEqual(['NodeB'])
  })

  test('skips widget-ledger keys owned by a disabled node', () => {
    expect(
      stalenessCheckedKeys(cloudEntry({ NodeA: ['DisabledOnCloud'] }), {
        'NodeA.widget': 'pack-owned value',
        'NodeAExtra.widget': 'different node'
      })
    ).toEqual(['NodeAExtra.widget'])
  })

  test('skips a ledgered node the env pin predates, and only for its own pack', () => {
    const skewed = {
      ContextWindowsVisualizerKJ: 'custom canvas overlay',
      'ContextWindowsVisualizerKJ.widget': 'widget value',
      'ContextWindowsVisualizerKJExtra.widget': 'different node'
    }
    expect(
      stalenessCheckedKeys(cloudEntry({}, 'ComfyUI-KJNodes'), skewed)
    ).toEqual(['ContextWindowsVisualizerKJExtra.widget'])
    expect(stalenessCheckedKeys(cloudEntry(), skewed)).toEqual([
      'ContextWindowsVisualizerKJ',
      'ContextWindowsVisualizerKJ.widget',
      'ContextWindowsVisualizerKJExtra.widget'
    ])
    expect(stalenessCheckedKeys(coreEntry('ComfyUI-KJNodes'), skewed)).toEqual([
      'ContextWindowsVisualizerKJ',
      'ContextWindowsVisualizerKJ.widget',
      'ContextWindowsVisualizerKJExtra.widget'
    ])
  })

  test('an empty ledger checks nothing', () => {
    expect(stalenessCheckedKeys(cloudEntry(), {})).toEqual([])
  })
})

test.describe('disabledHarnessNodes', () => {
  test('flags only harness nodes, carrying their labels as the mechanism', () => {
    expect(disabledHarnessNodes({})).toEqual([])
    expect(disabledHarnessNodes({ CheckpointSave: ['WritesToDisk'] })).toEqual(
      []
    )
    expect(
      disabledHarnessNodes({
        CheckpointSave: ['WritesToDisk'],
        EmptyImage: ['DisabledOnCloud'],
        PreviewAny: ['Stateful', 'WritesToDisk']
      })
    ).toEqual([
      'EmptyImage (DisabledOnCloud)',
      'PreviewAny (Stateful, WritesToDisk)'
    ])
  })
})
