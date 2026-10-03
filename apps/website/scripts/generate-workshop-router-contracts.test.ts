import { describe, expect, it } from 'vitest'

import packedContracts from '../src/content/workshop-router-contracts.json'
import rawSnapshots from '../src/data/workshop-router-openapi.snapshot.json'
import { workshopRouterIndexSchema } from '../src/config/workshop-router-index'
import { compileWorkshopIndex } from './generate-workshop-router-contracts'

const NATIVE_ID = 'kling/kling-v3'
const LEG = { provider: 'higgsfield', model_id: 'higgsfield/kling-3-std' }
const NO_PINS = { docsCommit: 'a'.repeat(40), models: {} }

function nativeSnapshot(altProviders?: unknown) {
  const snapshot = rawSnapshots.find((entry) => entry.id === NATIVE_ID)
  if (!snapshot) throw new Error(`Missing snapshot fixture: ${NATIVE_ID}`)
  return altProviders === undefined
    ? snapshot
    : {
        ...snapshot,
        document: {
          ...snapshot.document,
          'x-comfy-router-alt-providers': altProviders
        }
      }
}

function compileNative(snapshot: unknown, pins: unknown = NO_PINS) {
  const contracts = packedContracts.filter((entry) => entry.id === NATIVE_ID)
  const [record] = workshopRouterIndexSchema.parse(
    JSON.parse(compileWorkshopIndex([snapshot], contracts, {}, pins))
  )
  return record
}

describe('compileWorkshopIndex alt providers', () => {
  it("publishes a native schema's alt-provider legs as altProviders", () => {
    expect(compileNative(nativeSnapshot([LEG])).altProviders).toEqual([
      { provider: 'higgsfield', routerId: 'higgsfield/kling-3-std' }
    ])
  })

  it.for([
    { case: 'no alt providers', altProviders: undefined },
    { case: 'an empty alt-provider list', altProviders: [] }
  ])('omits the key for a schema with $case', ({ altProviders }) => {
    expect(compileNative(nativeSnapshot(altProviders))).not.toHaveProperty(
      'altProviders'
    )
  })

  it('reads pinned legs for a schema that does not publish them yet', () => {
    const pins = { ...NO_PINS, models: { [NATIVE_ID]: [LEG] } }
    expect(compileNative(nativeSnapshot(), pins).altProviders).toEqual([
      { provider: 'higgsfield', routerId: 'higgsfield/kling-3-std' }
    ])
  })

  it.for([
    {
      case: 'a pin the snapshot already publishes',
      snapshot: nativeSnapshot([LEG]),
      pins: { ...NO_PINS, models: { [NATIVE_ID]: [LEG] } },
      error: 'Drop the pinned alt providers'
    },
    {
      case: "a leg outside its provider's namespace",
      snapshot: nativeSnapshot([{ ...LEG, provider: 'fal' }]),
      pins: NO_PINS,
      error: 'is not served by fal'
    }
  ])('rejects $case', ({ snapshot, pins, error }) => {
    expect(() => compileNative(snapshot, pins)).toThrow(error)
  })
})
