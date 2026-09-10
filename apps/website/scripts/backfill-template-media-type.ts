/**
 * The template index records the media type of the *thumbnail*, so 599 of the
 * 610 entries claim `image` — including every video workflow. This rewrites
 * `mediaType` from what the workflow actually produces: its first declared
 * output where the details snapshot has one, and otherwise the medium named by
 * its tags. Run it after refreshing either snapshot.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

interface IndexEntry {
  name: string
  mediaType: string
  tags: string[]
}
interface DetailEntry {
  outputs?: { mediaType?: string }[]
}

const index = JSON.parse(readFileSync(INDEX, 'utf8')) as IndexEntry[]
const details = JSON.parse(readFileSync(DETAILS, 'utf8')) as Record<
  string,
  DetailEntry
>

function mediaTypeOf(entry: IndexEntry): MediaType {
  const declared = details[entry.name]?.outputs?.[0]?.mediaType
  if (isMediaType(declared)) return declared
  return TAG_MEDIA.find(([tag]) => entry.tags.includes(tag))?.[1] ?? 'image'
}

let changed = 0
for (const entry of index) {
  const mediaType = mediaTypeOf(entry)
  if (mediaType !== entry.mediaType) changed++
  entry.mediaType = mediaType
}

writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`)

const counts = new Map<string, number>()
for (const entry of index)
  counts.set(entry.mediaType, (counts.get(entry.mediaType) ?? 0) + 1)
console.log(
  `Rewrote ${changed} of ${index.length} media types:`,
  Object.fromEntries([...counts].sort())
)
