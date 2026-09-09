import { expect, it } from 'vitest'
import {
  connectivityExpectations,
  pairEndpointOwnershipIssues,
  pairEndpointPacks,
  pairExpectationKeys,
  pairExpectationNodeTypes
} from '@e2e/fixtures/customNode/connectivityExpectations'
import { loadAllManifestPackNames } from '@e2e/fixtures/customNode/manifest'

it('connectivity pair expectations are attributable and disjoint', () => {
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

it('pair endpoint ownership is checked only on the shard that owns it', () => {
  const endpointPacks = { ExampleNode: 'ExamplePack' }
  expect(
    pairEndpointOwnershipIssues(
      ['UnknownNode'],
      [],
      new Set(['DifferentPack']),
      endpointPacks
    )
  ).toEqual(['UnknownNode: no endpoint pack attribution exists'])

  expect(
    pairEndpointOwnershipIssues(['ExampleNode'], [], new Set(), endpointPacks)
  ).toEqual([])
  expect(
    pairEndpointOwnershipIssues(
      ['ExampleNode'],
      [],
      new Set(['ExamplePack']),
      endpointPacks
    )
  ).toEqual(['ExampleNode: not registered by ExamplePack'])
  expect(
    pairEndpointOwnershipIssues(
      ['ExampleNode'],
      [{ type: 'ExampleNode', pack: 'OtherPack' }],
      new Set(['ExamplePack']),
      endpointPacks
    )
  ).toEqual(['ExampleNode: expected ExamplePack, observed OtherPack'])
  expect(
    pairEndpointOwnershipIssues(
      ['ExampleNode'],
      [{ type: 'ExampleNode', pack: 'ExamplePack' }],
      new Set(['ExamplePack']),
      endpointPacks
    )
  ).toEqual([])
})
