import { describe, expect, it } from 'vitest'

import { compileWorkshopAliases } from '../../scripts/generate-workshop-router-aliases'
import rawAudit from '../data/workshop-router-identity-audit.json'
import rawSnapshots from '../data/workshop-router-openapi.snapshot.json'
import catalog from '../content/workshop-models.json'
import display from '../content/workshop-display.json'
import packedAliases from '../content/workshop-router-aliases.json'
import {
  workshopModels,
  filterWorkshopModels,
  countByModality
} from './models-catalogue'
import { routerWorkshopModelPaths } from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { workshopContract } from './workshop-contract-catalog'
import {
  workshopIdentityAuditSchema,
  workshopRouterAliasesSchema
} from './workshop-router-identity'

const audit = workshopIdentityAuditSchema.parse(rawAudit)
const aliases = workshopRouterAliasesSchema.parse(packedAliases)
const aliasesById = new Map(aliases.map((alias) => [alias.id, alias]))

describe('legacy content identity repairs', () => {
  it('reproduces the reviewed join data deterministically, one record per line', () => {
    const packed = compileWorkshopAliases(audit, catalog, rawSnapshots)
    expect(JSON.parse(packed)).toEqual(packedAliases)
    expect(packed.trimEnd().split('\n')).toHaveLength(aliases.length + 2)
    expect(
      compileWorkshopAliases(
        { ...audit, records: [...audit.records].reverse() },
        [...catalog].reverse(),
        [...rawSnapshots].reverse()
      )
    ).toBe(packed)
  })

  it('rejects incomplete, duplicated, stale and invented identity evidence', () => {
    for (const records of [
      audit.records.slice(1),
      [...audit.records, audit.records[0]],
      [
        { ...audit.records[0], legacyId: 'invented/model' },
        ...audit.records.slice(1)
      ]
    ])
      expect(() =>
        compileWorkshopAliases({ ...audit, records }, catalog, rawSnapshots)
      ).toThrow('cover every catalog ID exactly once')
    expect(() =>
      compileWorkshopAliases(
        { ...audit, sourceCommit: 'a'.repeat(40) },
        catalog,
        rawSnapshots
      )
    ).toThrow('commits differ')
    for (const first of [
      { ...audit.records[0], status: 'verified', matches: [] },
      { ...audit.records[0], status: 'unavailable' },
      { ...audit.records[0], matches: [{ routerId: 'invented/model' }] }
    ])
      expect(() =>
        compileWorkshopAliases(
          { ...audit, records: [first, ...audit.records.slice(1)] },
          catalog,
          rawSnapshots
        )
      ).toThrow('Invalid identity targets')
  })

  it.for(audit.records)(
    'retains $legacyId without guessing an identity',
    (record) => {
      const old = catalog.find((entry) => entry.id === record.legacyId)
      if (!old) throw new Error('Unknown legacy entry')
      const detail = getRouterWorkshopModelDetail(old.slug)
      const alias = aliasesById.get(record.legacyId)
      if (record.status !== 'verified' || record.matches.length !== 1) {
        expect(alias).toBeUndefined()
        expect(detail).toBeUndefined()
        expect(routerWorkshopModelPaths).not.toContain(old.slug)
        return
      }
      const match = record.matches[0]
      expect(alias?.routerId).toBe(match.routerId)
      expect(detail?.routerId).toBe(match.routerId)
      expect(detail?.href).toBe(`/models/${match.routerId.replace('/', '--')}/`)
      expect(routerWorkshopModelPaths).toContain(old.slug)
      const contract = workshopContract(match.routerId)
      if (!contract) {
        expect(detail?.incompleteReason).toBe('missing-input-schema')
        expect(detail?.execution).toBeUndefined()
      } else {
        expect(detail?.incompleteReason).toBeUndefined()
        expect(detail?.execution).toEqual(contract)
        expect(detail?.form?.source).toBe('router')
        for (const example of detail?.examples ?? []) {
          expect(example.values).toEqual({})
          expect(example.sampleOnly).toBe(true)
        }
      }
    }
  )

  it('publishes the verified intersection, never the union or duplicate cards', () => {
    const nativeIds = new Set(rawSnapshots.map((entry) => entry.id))
    const joinedIds = new Set(aliases.map((alias) => alias.routerId))
    expect(new Set(workshopModels.map((model) => model.routerId))).toEqual(
      joinedIds
    )
    expect(workshopModels).toHaveLength(joinedIds.size)
    for (const model of workshopModels)
      expect(nativeIds.has(model.routerId)).toBe(true)
    for (const snapshot of rawSnapshots.filter(
      (entry) => !joinedIds.has(entry.id)
    )) {
      expect(
        getRouterWorkshopModelDetail(snapshot.id.replace('/', '--'))
      ).toBeUndefined()
      expect(routerWorkshopModelPaths).not.toContain(
        snapshot.id.replace('/', '--')
      )
    }
    const linked = workshopModels.filter(
      (model) => model.routerId === 'bria/image-edit-erase'
    )
    expect(linked).toHaveLength(1)
    expect(linked[0].slug).toBe('bria--image-edit-erase')
    expect(
      getRouterWorkshopModelDetail('bria--image-edit-erase')?.execution?.id
    ).toBe('bria/image-edit-erase')
  })

  it('keeps both real output categories when two tasks share one Router model', () => {
    const beeble = workshopModels.find(
      (model) => model.routerId === 'beeble/switchx'
    )
    if (!beeble) throw new Error('Missing SwitchX')
    expect(beeble.useCases).toEqual(
      expect.arrayContaining(['edit-images', 'edit-videos'])
    )
    for (const modality of ['image', 'video'])
      expect(
        filterWorkshopModels([beeble], { modalities: [modality] })
      ).toEqual([beeble])
    expect(countByModality([beeble])).toMatchObject({
      all: 1,
      image: 1,
      video: 1
    })
  })

  it('quarantines the incorrect Starfish media without deleting Rob’s source record', () => {
    const original = display.find((entry) => entry.id === 'heygen/starfish-tts')
    expect(original?.media.thumbnail).toBeDefined()
    expect(original?.examples.length).toBeGreaterThan(0)
    const model = getRouterWorkshopModelDetail('heygen--starfish-tts')
    expect(model?.execution?.id).toBe('heygen/starfish')
    expect(model?.thumbnail).toBeUndefined()
    expect(model?.examples).toEqual([])
  })
})
