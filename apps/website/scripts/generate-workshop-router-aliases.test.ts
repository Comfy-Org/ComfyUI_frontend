import { describe, expect, it } from 'vitest'

import catalog from '../src/content/workshop-models.json'
import packedAliases from '../src/content/workshop-router-aliases.json'
import rawAudit from '../src/data/workshop-router-identity-audit.json'
import rawSnapshots from '../src/data/workshop-router-openapi.snapshot.json'
import { workshopIdentityAuditSchema } from '../src/config/workshop-router-identity'
import { compileWorkshopAliases } from './generate-workshop-router-aliases'

const audit = workshopIdentityAuditSchema.parse(rawAudit)

describe('compileWorkshopAliases', () => {
  it('reproduces the reviewed join data deterministically, one record per line', () => {
    const packed = compileWorkshopAliases(audit, catalog, rawSnapshots)
    expect(JSON.parse(packed)).toEqual(packedAliases)
    expect(packed.trimEnd().split('\n')).toHaveLength(packedAliases.length + 2)
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
})
