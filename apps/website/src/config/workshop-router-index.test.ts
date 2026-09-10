import { describe, expect, it } from 'vitest'

import {
  compileWorkshopContracts,
  compileWorkshopIndex
} from '../../scripts/generate-workshop-router-contracts'
import packedContracts from '../content/workshop-router-contracts.json'
import packedIndex from '../content/workshop-router-index.json'
import rawSnapshots from '../data/workshop-router-openapi.snapshot.json'
import { workshopModels } from './models-catalogue'
import {
  routerWorkshopModelPaths,
  routerContentById
} from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { parseRouterOpenApiSnapshot } from './workshop-router-openapi'
import { workshopRouterIndexSchema } from './workshop-router-index'

const snapshots = rawSnapshots.map(parseRouterOpenApiSnapshot)
const missing = snapshots.filter(
  (snapshot) => !snapshot.document['x-comfy-input-schema-authored']
)

describe('Router catalog completeness', () => {
  it('packs every known Router ID deterministically, including missing schemas', () => {
    const packed = compileWorkshopIndex(rawSnapshots, packedContracts)
    const index = workshopRouterIndexSchema.parse(JSON.parse(packed))
    expect(index).toEqual(packedIndex)
    expect(index.map((record) => record.id).sort()).toEqual(
      snapshots.map((snapshot) => snapshot.id).sort()
    )
    expect(
      index
        .filter((record) => record.incompleteReason)
        .map((record) => record.id)
        .sort()
    ).toEqual(missing.map((snapshot) => snapshot.id).sort())
    expect(
      compileWorkshopIndex(
        [...rawSnapshots].reverse(),
        [...packedContracts].reverse()
      )
    ).toBe(packed)
    expect(packed.trimEnd().split('\n')).toHaveLength(snapshots.length + 2)
  })

  it.for(missing)(
    'withholds $id until it has an authored input contract',
    (snapshot) => {
      const card = workshopModels.find(
        (model) => model.routerId === snapshot.id
      )
      expect(card).toBeUndefined()
      expect(routerContentById.has(snapshot.id)).toBe(false)
      const nativeSlug = snapshot.id.replace('/', '--')
      expect(routerWorkshopModelPaths).not.toContain(nativeSlug)
      const detail = getRouterWorkshopModelDetail(nativeSlug)
      expect(detail).toBeUndefined()
    }
  )

  it('publishes only complete Router contracts', () => {
    const executable = new Set(packedContracts.map((record) => record.id))
    const native = new Set(snapshots.map((snapshot) => snapshot.id))
    for (const card of workshopModels) {
      const detail = getRouterWorkshopModelDetail(card.slug)
      expect(card.incompleteReason).toBeUndefined()
      expect(executable.has(card.routerId)).toBe(true)
      expect(detail?.execution).toBeDefined()
      expect(native.has(card.routerId)).toBe(true)
      expect(detail?.summary).toBe(card.summary)
      expect(detail?.thumbnail).toEqual(card.thumbnail)
      expect(detail?.examples.length).toBe(card.workflowCount)
    }
  })

  it('removes the incomplete marker when an authored schema is supplied', () => {
    const original = missing[0]
    const updated = {
      ...original,
      document: { ...original.document, 'x-comfy-input-schema-authored': true }
    }
    const contracts: unknown = JSON.parse(compileWorkshopContracts([updated]))
    const index = workshopRouterIndexSchema.parse(
      JSON.parse(compileWorkshopIndex([updated], contracts))
    )
    expect(index[0].incompleteReason).toBeUndefined()
    expect(index[0].id).toBe(original.id)
    expect(() => compileWorkshopIndex([updated], [])).toThrow(
      'contract mismatch'
    )
    expect(() => compileWorkshopIndex([original], contracts)).toThrow(
      'contract mismatch'
    )
  })

  it('rejects duplicate identities and orphaned contracts', () => {
    expect(() =>
      compileWorkshopIndex([...rawSnapshots, rawSnapshots[0]], packedContracts)
    ).toThrow('do not match')
    expect(() =>
      compileWorkshopIndex(rawSnapshots, [
        ...packedContracts,
        packedContracts[0]
      ])
    ).toThrow('do not match')
    expect(() => compileWorkshopIndex([], packedContracts)).toThrow(
      'do not match'
    )
  })
})
