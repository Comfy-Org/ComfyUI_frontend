import { describe, expect, it } from 'vitest'

import {
  compileWorkshopContracts,
  compileWorkshopIndex
} from '@website/scripts/generate-workshop-router-contracts'
import packedContracts from '@/content/workshop-router-contracts.json'
import packedIndex from '@/content/workshop-router-index.json'
import rawSnapshots from '@/data/workshop-router-openapi.snapshot.json'
import {
  workshopModels,
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
  it('withholds an authored contract whose pinned Router dispatch is disabled', () => {
    const index = workshopRouterIndexSchema.parse(packedIndex)
    const disabled = index.find(
      (record) => record.id === 'ideogram/p-image-ideogram'
    )
    expect(disabled?.incompleteReason).toBeUndefined()
    expect(disabled?.unavailableReason).toBe('router-not-enabled')
    expect(
      workshopModels.some((model) => model.routerId === disabled?.id)
    ).toBe(false)
    expect(
      getRouterWorkshopModelDetail('ideogram--p-image-ideogram')
    ).toBeUndefined()
    expect(
      routerWorkshopModelPaths.some((slug) => slug.includes('p-image-ideogram'))
    ).toBe(false)
  })

  const altProviderLegs = new Map(
    workshopRouterIndexSchema
      .parse(packedIndex)
      .map((record) => [
        record.id,
        record.altProviders?.map(({ routerId }) => routerId)
      ])
  )

  it.for([
    {
      id: 'kling/kling-v3',
      routerIds: ['higgsfield/higgsfield-kling-3-std']
    },
    {
      id: 'kling/kling-3.0-turbo',
      routerIds: ['higgsfield/higgsfield-kling-3-turbo']
    },
    { id: 'wan/wan3.0-video', routerIds: ['higgsfield/higgsfield-wan-3'] },
    {
      id: 'byteplus/dreamina-seedance-2-0-260128',
      routerIds: [
        'fal/fal-seedance-2.0',
        'higgsfield/higgsfield-seedance-2.0',
        'runware/runware-seedance-2.0',
        'wavespeed/wavespeed-seedance-2.0'
      ]
    },
    {
      id: 'byteplus/dreamina-seedance-2-5-260628',
      routerIds: [
        'fal/fal-seedance-2.5',
        'higgsfield/higgsfield-seedance-2.5',
        'runware/runware-seedance-2.5',
        'wavespeed/wavespeed-seedance-2.5'
      ]
    },
    {
      id: 'openai/gpt-image-2',
      routerIds: [
        'fal/fal-gpt-image-2',
        'runware/runware-gpt-image-2',
        'wavespeed/wavespeed-gpt-image-2'
      ]
    },
    {
      id: 'openai/gpt-image-2.5-flare',
      routerIds: [
        'fal/fal-gpt-image-2.5-flare',
        'runware/runware-gpt-image-2.5-flare',
        'wavespeed/wavespeed-gpt-image-2.5-flare'
      ]
    },
    {
      id: 'openai/gpt-image-2.5-sunburst',
      routerIds: [
        'fal/fal-gpt-image-2.5-sunburst',
        'runware/runware-gpt-image-2.5-sunburst',
        'wavespeed/wavespeed-gpt-image-2.5-sunburst'
      ]
    },
    {
      id: 'vertexai/gemini-3.1-flash-image',
      routerIds: [
        'fal/fal-nano-banana-2',
        'runware/runware-nano-banana-2',
        'wavespeed/wavespeed-nano-banana-2'
      ]
    },
    {
      id: 'vertexai/gemini-3-pro-image',
      routerIds: [
        'fal/fal-nano-banana-pro',
        'runware/runware-nano-banana-pro',
        'wavespeed/wavespeed-nano-banana-pro'
      ]
    }
  ])('publishes the alt-provider legs serving $id', ({ id, routerIds }) => {
    expect(altProviderLegs.get(id)).toEqual(routerIds)
  })

  it('publishes every alt-provider leg the Router snapshot carries', () => {
    expect(
      [...altProviderLegs.values()].flatMap((routerIds) => routerIds ?? [])
    ).toHaveLength(26)
  })

  it('requires rechecking an availability override when its Router snapshot changes', () => {
    const updated = rawSnapshots.map((snapshot) =>
      snapshot.id === 'ideogram/p-image-ideogram'
        ? { ...snapshot, sourceCommit: '0'.repeat(40) }
        : snapshot
    )
    expect(() => compileWorkshopIndex(updated, packedContracts)).toThrow(
      'Recheck Router availability'
    )
  })

  it('preserves full descriptions instead of cutting them mid-sentence', () => {
    const description = 'A complete Router model description. '.repeat(20)
    const original = snapshots[0]
    const contract = packedContracts.find((entry) => entry.id === original.id)
    if (!contract) throw new Error('Missing authored fixture contract')
    const updated = {
      ...contract,
      inputSchema: { ...contract.inputSchema, description }
    }
    const [record] = workshopRouterIndexSchema.parse(
      JSON.parse(compileWorkshopIndex([original], [updated]))
    )
    expect(record.description).toBe(description)
  })

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
