/**
 * The template index records the media type of the *thumbnail*, so 599 of the
 * 610 entries claim `image` — including every video workflow. This rewrites
 * `mediaType` from what the workflow actually produces: its first declared
 * output where the details snapshot has one, and otherwise the medium named by
 * its tags. Run it after refreshing either snapshot.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  hubTemplateDetailsSchema,
  hubTemplatesSchema
} from '../src/lib/hub/types'
import type { HubTemplate, HubTemplateDetails } from '../src/lib/hub/types'
import { isDirectExecution } from './script-entry-point'

const DATA = join(import.meta.dirname, '..', 'src', 'data')
const INDEX = join(DATA, 'hubTemplates.json')
const DETAILS = join(DATA, 'hubTemplateDetails.json')

const MEDIA_TYPES = ['image', 'video', 'audio', '3d'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const isMediaType = (value: unknown): value is MediaType =>
  typeof value === 'string' &&
  (MEDIA_TYPES as readonly string[]).includes(value)

// Ordered: the first tag a template carries decides, so a "Video Edit" wins
// over the broad "Video" and both win over the image default.
const TAG_MEDIA: readonly [string, MediaType][] = [
  ['Image to 3D', '3d'],
  ['Text to Model', '3d'],
  ['Image to Model', '3d'],
  ['3D', '3d'],
  ['Text to Speech', 'audio'],
  ['TTS', 'audio'],
  ['Voice Cloning', 'audio'],
  ['Text to Music', 'audio'],
  ['Text to Audio', 'audio'],
  ['Audio Editing', 'audio'],
  ['Music', 'audio'],
  ['Audio', 'audio'],
  ['Image to Video', 'video'],
  ['Text to Video', 'video'],
  ['Reference to Video', 'video'],
  ['Audio to Video', 'video'],
  ['FLF2V', 'video'],
  ['Lip Sync', 'video'],
  ['Video Edit', 'video'],
  ['Video to Video', 'video'],
  ['Video Extend', 'video'],
  ['Video Upscale', 'video'],
  ['Frame Interpolation', 'video'],
  ['Motion Control', 'video'],
  ['Video', 'video']
]

function mediaTypeOf(
  entry: HubTemplate,
  details: HubTemplateDetails
): MediaType {
  const declared = details[entry.name]?.outputs?.[0]?.mediaType
  if (isMediaType(declared)) return declared
  return TAG_MEDIA.find(([tag]) => entry.tags.includes(tag))?.[1] ?? 'image'
}

export function backfillTemplateMediaTypes(
  rawIndex: unknown,
  rawDetails: unknown
): { index: HubTemplate[]; changed: number } {
  const index = hubTemplatesSchema.parse(rawIndex)
  const details = hubTemplateDetailsSchema.parse(rawDetails)
  let changed = 0
  const updated = index.map((entry) => {
    const mediaType = mediaTypeOf(entry, details)
    if (mediaType !== entry.mediaType) changed++
    return { ...entry, mediaType }
  })
  return { index: updated, changed }
}

function main() {
  const rawIndex: unknown = JSON.parse(readFileSync(INDEX, 'utf8'))
  const rawDetails: unknown = JSON.parse(readFileSync(DETAILS, 'utf8'))
  const { index, changed } = backfillTemplateMediaTypes(rawIndex, rawDetails)
  writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`)

  const counts = new Map<string, number>()
  for (const entry of index)
    counts.set(entry.mediaType, (counts.get(entry.mediaType) ?? 0) + 1)
  process.stdout.write(
    `Rewrote ${changed} of ${index.length} media types: ${JSON.stringify(
      Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)))
    )}\n`
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
