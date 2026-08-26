import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  connectivityExpectations,
  pairEndpointOwnershipIssues,
  pairEndpointPacks,
  pairExpectationKeys,
  pairExpectationNodeTypes
} from '@e2e/fixtures/customNode/connectivityExpectations'
import { loadAllManifestPackNames } from '@e2e/fixtures/customNode/manifest'

test('connectivity pair expectations are attributable and disjoint', () => {
  const manifestPacks = new Set(
    loadAllManifestPackNames().map((pack) => pack.toLowerCase())
  )
  const groups = [
    ...connectivityExpectations.connectRejected,
    ...connectivityExpectations.deterministicSlotContractMismatch,
    ...connectivityExpectations.dynamicSlotCleanupStalled,
    ...connectivityExpectations.roundtripLost
  ]
  for (const group of groups) {
    expect(group.id).toBeTruthy()
    expect(group.pack).toBeTruthy()
    expect(group.reason).toBeTruthy()
    expect(group.restore).toBeTruthy()
    expect(group.pairs.length).toBeGreaterThan(0)
    expect(manifestPacks.has(group.pack.toLowerCase())).toBe(true)
  }

  expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length)
  const pairs = pairExpectationKeys(groups)
  expect(new Set(pairs).size).toBe(pairs.length)
  expect(Object.keys(pairEndpointPacks).sort()).toEqual(
    pairExpectationNodeTypes(groups)
  )
  for (const pack of Object.values(pairEndpointPacks))
    expect(pack === 'core' || manifestPacks.has(pack.toLowerCase())).toBe(true)
})

test('pair endpoint ownership is checked only on the shard that owns it', () => {
  expect(
    pairEndpointOwnershipIssues(
      ['CrossShardNode'],
      [],
      new Set(['DifferentPack'])
    )
  ).toEqual(['CrossShardNode: no endpoint pack attribution exists'])

  const required = ['FL_TimeLine']
  expect(pairEndpointOwnershipIssues(required, [], new Set())).toEqual([])
  expect(
    pairEndpointOwnershipIssues(required, [], new Set(['ComfyUI_Fill-Nodes']))
  ).toEqual(['FL_TimeLine: not registered by ComfyUI_Fill-Nodes'])
  expect(
    pairEndpointOwnershipIssues(
      required,
      [{ type: 'FL_TimeLine', pack: 'OtherPack' }],
      new Set(['ComfyUI_Fill-Nodes'])
    )
  ).toEqual(['FL_TimeLine: expected ComfyUI_Fill-Nodes, observed OtherPack'])
  expect(
    pairEndpointOwnershipIssues(
      required,
      [{ type: 'FL_TimeLine', pack: 'ComfyUI_Fill-Nodes' }],
      new Set(['ComfyUI_Fill-Nodes'])
    )
  ).toEqual([])
})
