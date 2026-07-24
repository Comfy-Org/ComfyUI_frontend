import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  cloudAutoRunExclusions,
  disabledHarnessNodes
} from '@e2e/fixtures/customNode/cloudExclusions'
import type {
  CloudManifestEntry,
  CoreManifestEntry
} from '@e2e/fixtures/customNode/manifest'

function coreEntry(): CoreManifestEntry {
  return {
    pack: 'Example-Pack',
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
  disabledNodes: Record<string, string[]> = {}
): CloudManifestEntry {
  return {
    pack: 'Example-Pack',
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

test.describe('disabledHarnessNodes', () => {
  test('flags only harness nodes, carrying their labels as the mechanism', () => {
    expect(disabledHarnessNodes({})).toEqual([])
    // Core disables the save/training family on Cloud; none of it is
    // harness, so the guard stays quiet.
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
