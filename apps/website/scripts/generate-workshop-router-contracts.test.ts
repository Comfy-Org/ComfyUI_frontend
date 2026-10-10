import { describe, expect, it } from 'vitest'

import packedContracts from '@/content/workshop-router-contracts.json'
import rawSnapshots from '@/data/workshop-router-openapi.snapshot.json'
import { workshopRouterIndexSchema } from '@/config/workshop-router-index'
import { compileWorkshopIndex } from './generate-workshop-router-contracts'

const NATIVE_ID = 'kling/kling-v3'
const LEG = { provider: 'higgsfield', model_id: 'higgsfield/kling-3-std' }

function nativeSnapshot(altProviders?: unknown) {
  const snapshot = rawSnapshots.find((entry) => entry.id === NATIVE_ID)
  if (!snapshot) throw new Error(`Missing snapshot fixture: ${NATIVE_ID}`)
  const { 'x-comfy-router-alt-providers': _, ...document } = snapshot.document
  return {
    ...snapshot,
    document:
      altProviders === undefined
        ? document
        : { ...document, 'x-comfy-router-alt-providers': altProviders }
  }
}

function compileNative(snapshot: unknown) {
  const contracts = packedContracts.filter((entry) => entry.id === NATIVE_ID)
  const [record] = workshopRouterIndexSchema.parse(
    JSON.parse(compileWorkshopIndex([snapshot], contracts, {}))
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

  it.for([
    {
      case: "a leg outside its provider's namespace",
      altProviders: [{ ...LEG, provider: 'fal' }],
      error: 'is not served by fal'
    },
    {
      case: 'a leg naming its own model',
      altProviders: [{ provider: 'kling', model_id: NATIVE_ID }],
      error: 'names its own model'
    },
    {
      case: 'a repeated leg',
      altProviders: [LEG, LEG],
      error: 'Duplicate alt provider legs'
    },
    {
      case: 'an empty provider',
      altProviders: [{ provider: '', model_id: '/kling-3-std' }],
      error: 'Invalid'
    },
    {
      case: 'a multi-segment Router ID',
      altProviders: [{ ...LEG, model_id: 'higgsfield/a/b' }],
      error: 'Invalid'
    }
  ])('rejects $case', ({ altProviders, error }) => {
    expect(() => compileNative(nativeSnapshot(altProviders))).toThrow(error)
  })

  it('rejects a leg shared by two native models', () => {
    const otherId = 'kling/kling-3.0-turbo'
    const other = rawSnapshots.find((entry) => entry.id === otherId)
    if (!other) throw new Error(`Missing snapshot fixture: ${otherId}`)
    const shared = {
      ...other,
      document: { ...other.document, 'x-comfy-router-alt-providers': [LEG] }
    }
    const contracts = packedContracts.filter((entry) =>
      [NATIVE_ID, otherId].includes(entry.id)
    )
    expect(() =>
      compileWorkshopIndex([nativeSnapshot([LEG]), shared], contracts, {})
    ).toThrow('Duplicate alt provider legs')
  })
})
