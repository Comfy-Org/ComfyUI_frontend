import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getRouterWorkshopModelDetail } from '../config/workshop-router-content'
import {
  WORKSHOP_USE_CASES,
  workshopDisplaySchema
} from './workshop-display.schema'
import { workshopModelSchema } from './workshop-models.schema'

const here = import.meta.dirname
const display = (
  JSON.parse(
    readFileSync(join(here, 'workshop-display.json'), 'utf8')
  ) as unknown[]
).map((entry) => workshopDisplaySchema.parse(entry))
const catalog = (
  JSON.parse(
    readFileSync(join(here, 'workshop-models.json'), 'utf8')
  ) as unknown[]
).map((entry) => workshopModelSchema.parse(entry))

const modality = new Map(catalog.map((m) => [m.id, m.modality]))
const displayById = new Map(display.map((entry) => [entry.id, entry]))
const catalogById = new Map(catalog.map((entry) => [entry.id, entry]))
/** Outputs that are a single still frame. */
const STILL = new Set(['image', 'svg', '3d'])

describe('the display overlay against the catalog', () => {
  it('covers models the catalog actually has', () => {
    expect(display.length).toBeGreaterThan(0)
    const orphans = display
      .map((entry) => entry.id)
      .filter((id) => !modality.has(id))

    expect(orphans).toEqual([])
  })

  it('assigns every model at least one supported use case', () => {
    const supported = new Set<string>(WORKSHOP_USE_CASES)
    const unclassified = display
      .filter((entry) => entry.useCases.length === 0)
      .map((entry) => entry.id)
    const unknown = display.flatMap((entry) =>
      entry.useCases
        .filter((useCase) => !supported.has(useCase))
        .map((useCase) => `${entry.id} ${useCase}`)
    )

    expect(unclassified).toEqual([])
    expect(unknown).toEqual([])
  })

  it('keeps every Advanced field attached to a real generated input', () => {
    const stale = display.flatMap((entry) => {
      const model = catalogById.get(entry.id)
      if (!model) return []
      const properties =
        typeof model.parameters.properties === 'object' &&
        model.parameters.properties !== null &&
        !Array.isArray(model.parameters.properties)
          ? Object.keys(model.parameters.properties)
          : []
      const names = new Set([
        ...properties.filter(
          (name) => !['model', 'medias', 'dispatch_mode'].includes(name)
        ),
        ...model.roles.map((role) => `media_${role.role}`)
      ])
      return entry.advancedFields
        .filter((name) => !names.has(name))
        .map((name) => `${entry.id} ${name}`)
    })

    expect(stale).toEqual([])
  })

  it('records the content-side disclosure choices explicitly', () => {
    // The drop supplies `advancedFields` from one name-keyed table (seeds,
    // watermarks, safety knobs, prompt rewriting, sampler and 3D tuning, ...)
    // filtered to what each model exposes, so the positional fallback no
    // longer applies to Router models.
    const grouped = display.filter((entry) => entry.advancedFields.length > 0)
    expect(grouped).toHaveLength(210)
    expect(
      grouped.reduce((count, entry) => count + entry.advancedFields.length, 0)
    ).toBe(696)
    expect(displayById.get('meshy/text-to-model')?.advancedFields).toEqual([
      'seed',
      'target_polycount',
      'topology',
      'ultra_mode'
    ])
    expect(
      getRouterWorkshopModelDetail('meshy--text-to-model')
        ?.fields.filter((field) => field.advanced)
        .sort(
          (a, b) =>
            (a.advancedIndex ?? Number.MAX_SAFE_INTEGER) -
            (b.advancedIndex ?? Number.MAX_SAFE_INTEGER)
        )
        .map((field) => field.name)
    ).toEqual(displayById.get('meshy/text-to-model')?.advancedFields)
  })

  it('keeps multi-purpose models in each applicable use case', () => {
    expect(displayById.get('byteplus/seedream-4')?.useCases).toEqual([
      'generate-images',
      'edit-images'
    ])
    expect(displayById.get('gemini/omni-1.1-flash')?.useCases).toEqual([
      'generate-videos',
      'edit-videos'
    ])
  })

  it('classifies required media by what the model does with it', () => {
    expect(displayById.get('beeble/switchx-image-edit')?.useCases).toEqual([
      'edit-images'
    ])
    expect(displayById.get('bfl/flux-3-image-to-video')?.useCases).toEqual([
      'animate-images'
    ])
    expect(displayById.get('bfl/flux-3-video-continuation')?.useCases).toEqual([
      'edit-videos'
    ])
  })

  it('never puts a moving thumbnail on a model that makes stills', () => {
    // This shipped once: generic filename tokens matched an animated preview
    // onto image models, so a still model advertised itself with a video.
    const wrong = display
      .filter((entry) => STILL.has(modality.get(entry.id) ?? ''))
      .filter((entry) => entry.media.thumbnail?.kind === 'video')
      .map((entry) => entry.id)

    expect(wrong).toEqual([])
  })

  it('never puts a moving sample on a model that makes stills', () => {
    const wrong = display
      .filter((entry) => STILL.has(modality.get(entry.id) ?? ''))
      .flatMap((entry) =>
        (entry.media.samples ?? [])
          .filter((sample) => sample.kind === 'video')
          .map(() => entry.id)
      )

    expect(wrong).toEqual([])
  })

  it('has an output for every example, since they pair by index', () => {
    // The reverse is fine and real: some models ship a sample output with
    // nothing to prefill, because their inputs have no Router equivalent.
    const short = display
      .filter(
        (entry) => entry.examples.length > (entry.media.samples?.length ?? 0)
      )
      .map((entry) => entry.id)

    expect(short).toEqual([])
  })

  it('serves audio and video from an origin that sets a playable type', () => {
    // raw.githubusercontent.com labels MP4 and MP3 as application/octet-stream
    // with nosniff, so a browser refuses to play them. Images are unaffected.
    const unplayable = display.flatMap((entry) =>
      [entry.media.thumbnail, ...(entry.media.samples ?? [])]
        .filter((asset) => asset !== undefined)
        .filter((asset) => asset.kind !== 'image')
        .filter((asset) => new URL(asset.url).hostname.includes('raw.github'))
        .map((asset) => `${entry.id} ${asset.url}`)
    )

    expect(unplayable).toEqual([])
  })

  it('points every asset at https', () => {
    const insecure = display.flatMap((entry) =>
      [entry.media.thumbnail, ...(entry.media.samples ?? [])]
        .filter((asset) => asset !== undefined)
        .filter((asset) => !asset.url.startsWith('https://'))
        .map((asset) => asset.url)
    )

    expect(insecure).toEqual([])
  })
})
