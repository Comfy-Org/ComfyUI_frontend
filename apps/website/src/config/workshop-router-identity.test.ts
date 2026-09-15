import { describe, expect, it } from 'vitest'

import rawAudit from '../data/workshop-router-identity-audit.json'
import availability from '../data/workshop-router-availability.json'
import rawSnapshots from '../data/workshop-router-openapi.snapshot.json'
import catalog from '../content/workshop-models.json'
import display from '../content/workshop-display.json'
import packedAliases from '../content/workshop-router-aliases.json'
import { filterWorkshopModels, countByModality } from './models-catalogue'
import type { WorkshopModelDetail } from './models-catalogue'
import {
  workshopModels,
  routerWorkshopModelPaths
} from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { workshopContract } from './workshop-contract-catalog'
import { workshopContentInputs } from './workshop-content-inputs'
import { isWorkshopModelDisabled } from './workshop-model-availability'
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
const auditById = new Map(
  audit.records.map((record) => [record.legacyId, record])
)

function isPublishablePage(entry: { id: string; slug: string }): boolean {
  return (
    !workshopContentInputs.get(entry.id)?.unavailableReason &&
    !isWorkshopModelDisabled(entry.slug)
  )
}

function routerIdForPage(entry: { id: string; modelId: string }) {
  return (
    workshopContentInputs.get(entry.id)?.routerId ??
    aliasesById.get(entry.modelId)?.routerId
  )
}

type IdentityAuditRecord = (typeof audit.records)[number]

function legacyEntryFor(record: IdentityAuditRecord) {
  const entry = catalog.find((candidate) => candidate.id === record.legacyId)
  if (!entry) throw new Error(`Unknown legacy entry: ${record.legacyId}`)
  return entry
}

function pageTargetsFor(record: IdentityAuditRecord) {
  return display
    .filter(
      (entry) => entry.modelId === record.legacyId && isPublishablePage(entry)
    )
    .flatMap((entry) => {
      const routerId = routerIdForPage(entry)
      return routerId && workshopContract(routerId) ? [{ entry, routerId }] : []
    })
}

function expectValidExamples(detail: WorkshopModelDetail | undefined) {
  if (!detail) throw new Error('Missing model detail')
  for (const example of detail.examples) {
    const populated = schemaForModel(detail).filter((field) =>
      Object.hasOwn(example.values, field.name)
    )
    expect(populated).toHaveLength(Object.keys(example.values).length)
    expect(
      validateForm(populated, defaultValues(populated, example.values))
    ).toEqual({})
    expect(example.sampleOnly).toBe(Object.keys(example.values).length === 0)
  }
}

const unresolvedIdentityRecords = audit.records.filter(
  (record) => record.status !== 'verified' || record.matches.length !== 1
)
const pageBoundIdentityRecords = unresolvedIdentityRecords.filter(
  (record) => pageTargetsFor(record).length > 0
)
const unboundIdentityRecords = unresolvedIdentityRecords.filter(
  (record) => pageTargetsFor(record).length === 0
)
const singleTargetIdentityRecords = audit.records.filter(
  (record) => record.status === 'verified' && record.matches.length === 1
)

function hasPublishableSingleTarget(record: IdentityAuditRecord): boolean {
  const match = record.matches.at(0)
  if (!match || !workshopContract(match.routerId)) return false
  return (
    !Object.hasOwn(availability, match.routerId) &&
    display.some(
      (entry) => entry.modelId === record.legacyId && isPublishablePage(entry)
    )
  )
}

const publishedSingleTargetRecords = singleTargetIdentityRecords.filter(
  hasPublishableSingleTarget
)
const unpublishedSingleTargetRecords = singleTargetIdentityRecords.filter(
  (record) => !hasPublishableSingleTarget(record)
)

describe('legacy content identity repairs', () => {
  it.for(unboundIdentityRecords)(
    'keeps $legacyId unpublished rather than guessing an identity',
    (record) => {
      const old = legacyEntryFor(record)
      const detail = getRouterWorkshopModelDetail(old.slug)
      expect(aliasesById.get(record.legacyId)).toBeUndefined()
      expect(detail).toBeUndefined()
      expect(routerWorkshopModelPaths).not.toContain(old.slug)
    }
  )

  it.for(pageBoundIdentityRecords)(
    'publishes $legacyId only through verified page bindings',
    (record) => {
      const old = legacyEntryFor(record)
      const detail = getRouterWorkshopModelDetail(old.slug)
      expect(aliasesById.get(record.legacyId)).toBeUndefined()
      const pageTargets = pageTargetsFor(record)
      expect(record.status).toBe('verified')
      expect(
        pageTargets.every(({ routerId }) =>
          record.matches.some((match) => match.routerId === routerId)
        )
      ).toBe(true)
      expect(pageTargets.map(({ routerId }) => routerId)).toContain(
        detail?.routerId
      )
      expect(routerWorkshopModelPaths).toContain(old.slug)
    }
  )

  it.for(unpublishedSingleTargetRecords)(
    'keeps unavailable single target $legacyId unpublished',
    (record) => {
      const old = legacyEntryFor(record)
      const match = record.matches[0]
      expect(aliasesById.get(record.legacyId)?.routerId).toBe(match.routerId)
      expect(getRouterWorkshopModelDetail(old.slug)).toBeUndefined()
      expect(routerWorkshopModelPaths).not.toContain(old.slug)
    }
  )

  it.for(publishedSingleTargetRecords)(
    'publishes $legacyId through its verified identity',
    (record) => {
      const old = legacyEntryFor(record)
      const detail = getRouterWorkshopModelDetail(old.slug)
      const alias = aliasesById.get(record.legacyId)
      const match = record.matches[0]
      expect(alias?.routerId).toBe(match.routerId)
      const contract = workshopContract(match.routerId)
      if (!contract || !detail)
        throw new Error('Missing published model detail')
      expect(detail.routerId).toBe(match.routerId)
      expect(detail.slug.startsWith(`${old.slug}--`)).toBe(true)
      expect(detail.href).toBe(`/models/${detail.slug}/`)
      expect(routerWorkshopModelPaths).toContain(old.slug)
      expect(detail.incompleteReason).toBeUndefined()
      expect(detail.execution?.inputSchema).toEqual(contract.inputSchema)
      expect(detail.execution?.creator).toEqual(
        contract.creatorVariants?.[detail.slug] ?? contract.creator
      )
      expect(detail.form?.source).toBe('router')
      expectValidExamples(detail)
    }
  )

  it('publishes only verified Router joins with one distinct card per content record', () => {
    const nativeIds = new Set(rawSnapshots.map((entry) => entry.id))
    const content = display.flatMap((entry) => {
      const routerId = routerIdForPage(entry)
      return routerId &&
        workshopContract(routerId) &&
        !Object.hasOwn(availability, routerId) &&
        isPublishablePage(entry)
        ? [{ entry, routerId }]
        : []
    })
    const joinedIds = new Set(content.map(({ routerId }) => routerId))
    expect(new Set(workshopModels.map((model) => model.routerId))).toEqual(
      joinedIds
    )
    expect(workshopModels.map((model) => model.slug).sort()).toEqual(
      content.map(({ entry }) => entry.slug).sort()
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

  it('binds every role-specific page only to a verified family target', () => {
    for (const [id, binding] of workshopContentInputs) {
      const page = display.find((entry) => entry.id === id)
      if (!page) throw new Error(`Missing content page: ${id}`)
      const record = auditById.get(page.modelId)
      expect({ id, status: record?.status }).toMatchObject({
        status: 'verified'
      })
      expect(record?.matches.map((match) => match.routerId)).toContain(
        binding.routerId
      )
    }
  })

  it('requires every active page for a multi-target model to declare its Router target', () => {
    const multiTargetIds = new Set(
      audit.records
        .filter(
          (record) => record.status === 'verified' && record.matches.length > 1
        )
        .map((record) => record.legacyId)
    )
    const missing = display
      .filter(
        (entry) =>
          multiTargetIds.has(entry.modelId) &&
          !isWorkshopModelDisabled(entry.slug) &&
          !workshopContentInputs.has(entry.id)
      )
      .map((entry) => entry.id)
    expect(missing).toEqual([])
  })

  it('does not silently drop active content with a verified available target', () => {
    const published = new Set(workshopModels.map((model) => model.slug))
    const missing = display
      .filter((entry) => {
        if (!isPublishablePage(entry)) return false
        const record = auditById.get(entry.modelId)
        return (
          record?.status === 'verified' &&
          record.matches.some(
            (match) =>
              workshopContract(match.routerId) &&
              !Object.hasOwn(availability, match.routerId)
          ) &&
          !published.has(entry.slug)
        )
      })
      .map((entry) => entry.slug)
    expect(missing).toEqual([])
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
