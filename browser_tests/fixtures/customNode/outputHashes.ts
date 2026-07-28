import { createHash } from 'node:crypto'

// S15 output-regression tier: pixel-content hashes for curated run outputs.
//
// A frontend regression can corrupt what a workflow PRODUCES while the run
// still ends in execution_success (a serialization change that flips a seed,
// a widget value that stops reaching the prompt). The run tier proves "it
// ran"; this tier proves "it produced the same pixels".
//
// Hashes cover PNG pixel data ONLY (the concatenated IDAT chunks): ComfyUI
// embeds the prompt and workflow as tEXt/iTXt metadata, so whole-file hashes
// would false-fail on byte-identical pixels whenever the embedded workflow
// JSON shifts. Non-PNG outputs (video containers embed timestamps) are not
// hashable this way; enroll only PNG-producing sinks.

export interface OutputImageRef {
  nodeId: string
  filename: string
  subfolder: string
  type: string
}

function isImageRef(
  value: unknown
): value is { filename: string; subfolder?: string; type?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { filename?: unknown }).filename === 'string'
  )
}

// `executed` ui payloads carry `images: [{filename, subfolder, type}]` for
// image-producing sinks (SaveImage/PreviewImage classes). Shape-tolerant
// walk; anything without a filename is not an image output.
export function imageRefsFrom(
  outputsByNode: Record<string, unknown>
): OutputImageRef[] {
  const refs: OutputImageRef[] = []
  for (const [nodeId, payload] of Object.entries(outputsByNode)) {
    const images = (payload as { images?: unknown } | null)?.images
    if (!Array.isArray(images)) continue
    for (const image of images) {
      if (!isImageRef(image)) continue
      refs.push({
        nodeId,
        filename: image.filename,
        subfolder: image.subfolder ?? '',
        type: image.type ?? 'output'
      })
    }
  }
  return refs.sort(
    (a, b) =>
      a.nodeId.localeCompare(b.nodeId) || a.filename.localeCompare(b.filename)
  )
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

// sha256 over the concatenated IDAT payloads - the compressed pixel stream,
// byte-stable for identical pixels regardless of tEXt/iTXt metadata. Throws
// on non-PNG bytes: a sink expected to emit PNG that emits something else IS
// a regression, not a skippable case.
export function hashPngPixels(file: Buffer): string {
  if (!file.subarray(0, 8).equals(PNG_SIGNATURE))
    throw new Error(
      `not a PNG (starts ${file.subarray(0, 8).toString('hex')}) - S15 hashes cover PNG sinks only`
    )
  const hash = createHash('sha256')
  let offset = 8
  let sawIdat = false
  while (offset + 8 <= file.length) {
    const length = file.readUInt32BE(offset)
    const chunkType = file.toString('latin1', offset + 4, offset + 8)
    if (chunkType === 'IDAT') {
      hash.update(file.subarray(offset + 8, offset + 8 + length))
      sawIdat = true
    }
    if (chunkType === 'IEND') break
    offset += 12 + length
  }
  if (!sawIdat) throw new Error('PNG has no IDAT chunk - truncated file?')
  return `sha256:${hash.digest('hex')}`
}

// Key for one output inside one curated workflow: node id + filename index
// (filenames embed run-varying counters, e.g. ComfyUI_00001_.png, so the
// POSITION is stable while the NAME is not).
export function outputKey(ref: OutputImageRef, index: number): string {
  return `${ref.nodeId}[${index}]`
}

export type CuratedOutputHashes = Record<string, Record<string, string>>

export function compareOutputHashes(input: {
  workflowKey: string
  observed: Record<string, string>
  committed: CuratedOutputHashes
}): string[] {
  const { workflowKey, observed, committed } = input
  const expected = committed[workflowKey]
  if (!expected)
    return [
      `S15: no committed hashes for '${workflowKey}' - a curated run workflow ` +
        `must enroll its outputs (RECORD_OUTPUT_HASHES=1 run, commit the ` +
        `fixture) or carry a ledger entry with a mechanism`
    ]
  const problems: string[] = []
  for (const [key, digest] of Object.entries(expected)) {
    const actual = observed[key]
    if (actual === undefined)
      problems.push(
        `${workflowKey} ${key}: committed hash but the output is gone - the ` +
          `sink no longer produces this image`
      )
    else if (actual !== digest)
      problems.push(
        `${workflowKey} ${key}: pixel hash changed - expected ${digest}, got ` +
          `${actual}. A frontend change altered what this workflow produces`
      )
  }
  for (const key of Object.keys(observed))
    if (!(key in expected))
      problems.push(
        `${workflowKey} ${key}: new output with no committed hash - enroll it ` +
          `(a new image appearing is also a behavior change)`
      )
  return problems
}
