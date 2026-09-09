import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { workshopDisplaySchema } from './workshop-display.schema'
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
