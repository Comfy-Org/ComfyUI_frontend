import { describe, expect, it } from 'vitest'

import rawAudit from '../data/workshop-router-identity-audit.json'
import availability from '../data/workshop-router-availability.json'
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
import { workshopContentInputs } from './workshop-content-inputs'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import {
  workshopIdentityAuditSchema,
  workshopRouterAliasesSchema
} from './workshop-router-identity'

const audit = workshopIdentityAuditSchema.parse(rawAudit)
const aliases = workshopRouterAliasesSchema.parse(packedAliases)
const aliasesById = new Map(aliases.map((alias) => [alias.id, alias]))

describe('legacy content identity repairs', () => {
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
      const contract = workshopContract(match.routerId)
      if (!contract || Object.hasOwn(availability, match.routerId)) {
        expect(detail).toBeUndefined()
        expect(routerWorkshopModelPaths).not.toContain(old.slug)
        return
      }
      expect(detail?.routerId).toBe(match.routerId)
      expect(detail?.slug.startsWith(`${old.slug}--`)).toBe(true)
      expect(detail?.href).toBe(`/models/${detail?.slug}/`)
      expect(routerWorkshopModelPaths).toContain(old.slug)
      expect(detail?.incompleteReason).toBeUndefined()
      expect(detail?.execution?.inputSchema).toEqual(contract.inputSchema)
      expect(detail?.execution?.creator).toEqual(
        contract.creatorVariants?.[detail?.slug ?? ''] ?? contract.creator
      )
      expect(detail?.form?.source).toBe('router')
      for (const example of detail?.examples ?? []) {
        if (!detail) throw new Error('Missing model detail')
        const populated = schemaForModel(detail).filter((field) =>
          Object.hasOwn(example.values, field.name)
        )
        expect(populated).toHaveLength(Object.keys(example.values).length)
        expect(
          validateForm(populated, defaultValues(populated, example.values))
        ).toEqual({})
        expect(example.sampleOnly).toBe(
          Object.keys(example.values).length === 0
        )
      }
    }
  )

  it('publishes only verified Router joins with one distinct card per content record', () => {
    const nativeIds = new Set(rawSnapshots.map((entry) => entry.id))
    const publishedAliases = aliases.filter(
      (alias) =>
        workshopContract(alias.routerId) &&
        !Object.hasOwn(availability, alias.routerId)
    )
    const joinedIds = new Set(publishedAliases.map((alias) => alias.routerId))
    expect(new Set(workshopModels.map((model) => model.routerId))).toEqual(
      joinedIds
    )
    const publishedIds = new Set(publishedAliases.map((alias) => alias.id))
    const content = display.filter(
      (entry) =>
        publishedIds.has(entry.modelId) &&
        !workshopContentInputs.get(entry.id)?.unavailableReason
    )
    expect(workshopModels.map((model) => model.slug).sort()).toEqual(
      content.map((entry) => entry.slug).sort()
    )
    expect(new Set(workshopModels.map((model) => model.slug)).size).toBe(
      content.length
    )
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
    expect(linked[0].slug).toBe('bria--eraser--edit-images')
    expect(
      getRouterWorkshopModelDetail('bria--image-edit-erase')?.execution?.id
    ).toBe('bria/image-edit-erase')
  })

  it('keeps disabled models in the authored content without publishing their URLs', () => {
    expect(aliasesById.get('ideogram/p-image')?.routerId).toBe(
      'ideogram/p-image-ideogram'
    )
    expect(workshopContract('ideogram/p-image-ideogram')).toBeDefined()
    expect(display.some((entry) => entry.modelId === 'ideogram/p-image')).toBe(
      true
    )
    expect(getRouterWorkshopModelDetail('ideogram--p-image')).toBeUndefined()
    expect(routerWorkshopModelPaths).not.toContain('ideogram--p-image')
  })

  it('withholds missing input contracts and every associated URL without deleting content', () => {
    const missing = rawSnapshots.filter(
      (entry) => !entry.document['x-comfy-input-schema-authored']
    )
    expect(missing.map((entry) => entry.id)).toEqual(['minimax/minimax-h3'])
    for (const snapshot of missing) {
      const legacy = aliases.filter((alias) => alias.routerId === snapshot.id)
      expect(legacy.length).toBeGreaterThan(0)
      const ids = new Set(legacy.map((alias) => alias.id))
      const content = display.filter((entry) => ids.has(entry.modelId))
      expect(content.length).toBeGreaterThan(0)
      const slugs = [
        snapshot.id.replace('/', '--'),
        ...catalog
          .filter((entry) => ids.has(entry.id))
          .map((entry) => entry.slug),
        ...content.map((entry) => entry.slug)
      ]
      for (const slug of slugs) {
        expect(getRouterWorkshopModelDetail(slug)).toBeUndefined()
        expect(routerWorkshopModelPaths).not.toContain(slug)
      }
      expect(
        workshopModels.some((model) => model.routerId === snapshot.id)
      ).toBe(false)
    }
    expect(workshopModels.every((model) => !model.incompleteReason)).toBe(true)
  })

  it('keeps both real output categories when two tasks share one Router model', () => {
    const beeble = workshopModels.filter(
      (model) => model.routerId === 'beeble/switchx'
    )
    expect(beeble).toHaveLength(2)
    expect(beeble.map((entry) => entry.useCases)).toEqual([
      ['edit-images'],
      ['edit-videos']
    ])
    expect(beeble[0].slug).not.toBe(beeble[1].slug)
    expect(beeble[0].thumbnail?.url).not.toBe(beeble[1].thumbnail?.url)
    for (const modality of ['image', 'video'])
      expect(filterWorkshopModels(beeble, { modalities: [modality] })).toEqual(
        beeble.filter((model) => model.modality === modality)
      )
    expect(countByModality(beeble)).toMatchObject({
      all: 2,
      image: 1,
      video: 1
    })
  })

  it('quarantines the incorrect Starfish media without deleting Rob’s source record', () => {
    const original = display.find(
      (entry) => entry.modelId === 'heygen/starfish-tts'
    )
    expect(original?.withheldContent?.media.thumbnail).toBeDefined()
    expect(original?.withheldContent?.examples.length).toBeGreaterThan(0)
    const model = getRouterWorkshopModelDetail('heygen--starfish-tts')
    expect(model?.execution?.id).toBe('heygen/starfish')
    expect(model?.thumbnail).toBeUndefined()
    expect(model?.examples).toEqual([])
  })
})
