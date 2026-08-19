import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  connectivityExpectations,
  pairExpectationKeys
} from '@e2e/fixtures/customNode/connectivityExpectations'
import { loadAllManifestPackNames } from '@e2e/fixtures/customNode/manifest'

test('connectivity pair expectations are attributable and disjoint', () => {
  const manifestPacks = new Set(
    loadAllManifestPackNames().map((pack) => pack.toLowerCase())
  )
  const groups = [
    ...connectivityExpectations.connectRejected,
    ...connectivityExpectations.deterministicSlotContractMismatch,
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
})
