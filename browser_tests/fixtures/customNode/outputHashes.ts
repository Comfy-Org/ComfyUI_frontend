import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// S15 output-regression tier: content hashes for curated run outputs.
//
// A frontend regression can corrupt what a workflow PRODUCES while the run
// still ends in execution_success (a serialization change that drifts a
// widget value without invalidating it). The run tier proves "it ran"; this
// tier proves "it produced the same outputs": one digest per sink over its
// canonicalized ui payload, with PNG file refs hashed by pixel content
// (IDAT chunks only - ComfyUI embeds the prompt as tEXt metadata, so
// whole-file hashes would false-fail on byte-identical pixels).

export interface OutputImageRef {
  filename: string
  subfolder: string
  type: string
}

// The real ComfyUI output ref shape carries type and/or subfolder beside
// filename; requiring one prevents a value payload that merely CONTAINS a
// filename field from being collapsed (and its sibling keys dropped).
function isFileRef(
  value: unknown
): value is { filename: string; subfolder?: string; type?: string } {
  if (typeof value !== 'object' || value === null) return false
  const ref = value as Record<string, unknown>
  return (
    typeof ref.filename === 'string' &&
    (typeof ref.type === 'string' || typeof ref.subfolder === 'string')
  )
}

// Deterministic canonical form of a sink's ui payload. The curated corpus's
// sinks are mostly VALUE displays (text/number payloads) - the displayed
// value IS the output, so the payload itself is what gets hashed (record run
// 30316904957: zero `images` arrays across all six curated workflows).
// File refs embed run-varying counters (ComfyUI_00001_.png), so a ref
// canonicalizes to its extension plus, for PNGs, the pixel hash of the
// fetched file - content-stable where content is checkable, position-stable
// where it is not (video containers embed timestamps).
async function canonicalize(
  value: unknown,
  fetchFile: (ref: OutputImageRef) => Promise<Buffer>
): Promise<unknown> {
  if (Array.isArray(value)) {
    const out = []
    for (const item of value) out.push(await canonicalize(item, fetchFile))
    return out
  }
  if (isFileRef(value)) {
    const ext = (value.filename.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase()
    const ref: OutputImageRef = {
      filename: value.filename,
      subfolder: value.subfolder ?? '',
      type: value.type ?? 'output'
    }
    // Sibling keys (format, frame_rate, ...) are content - keep them; only
    // the run-varying filename collapses to its extension.
    const rest: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort())
      if (key !== 'filename')
        rest[key] = await canonicalize(
          (value as Record<string, unknown>)[key],
          fetchFile
        )
    if (ext === '.png')
      return { ...rest, file: ext, pixels: hashPngPixels(await fetchFile(ref)) }
    return { ...rest, file: ext }
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort())
      out[key] = await canonicalize(
        (value as Record<string, unknown>)[key],
        fetchFile
      )
    return out
  }
  return value
}

// One digest per sink node: sha256 over the canonicalized payload JSON.
export async function hashSinkPayloads(
  outputsByNode: Record<string, unknown>,
  fetchFile: (ref: OutputImageRef) => Promise<Buffer>
): Promise<Record<string, string>> {
  const observed: Record<string, string> = {}
  for (const nodeId of Object.keys(outputsByNode).sort()) {
    const canonical = await canonicalize(outputsByNode[nodeId], fetchFile)
    observed[nodeId] = `sha256:${createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex')}`
  }
  return observed
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
    if (offset + 12 + length > file.length)
      throw new Error(
        `PNG chunk ${chunkType} overruns the buffer - truncated file?`
      )
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

export interface CuratedOutputHashes {
  // Hashes are only comparable against the environment that recorded them
  // (the S14 geometry convention): pinned core + pack pins determine sink
  // payloads, and a drift red must name where its baseline came from.
  recordedAt: { core: string; run: string }
  schema: 1
  workflows: Record<string, Record<string, string>>
}

// Read-merge-write: record mode deliberately fails each test, and Playwright
// restarts the worker after a failure, so in-memory accumulation resets per
// test - proven by record run 30316246562, whose artifact held only the last
// test's entry. The file on disk is the accumulator.
export function recordObservedHashes(
  filePath: string,
  workflowKey: string,
  observed: Record<string, string>
): void {
  const existing: CuratedOutputHashes = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, 'utf-8'))
    : {
        recordedAt: {
          core: process.env.CN_OUTPUT_HASHES_CORE ?? 'unpinned-local',
          run: process.env.GITHUB_RUN_ID ?? 'local'
        },
        schema: 1,
        workflows: {}
      }
  existing.workflows[workflowKey] = observed
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(existing, null, 2))
}

export function compareOutputHashes(input: {
  workflowKey: string
  observed: Record<string, string>
  committed: CuratedOutputHashes
}): string[] {
  const { workflowKey, observed, committed } = input
  const provenance = `(baseline recorded at core ${committed.recordedAt.core}, run ${committed.recordedAt.run})`
  const expected = committed.workflows[workflowKey]
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
          `sink no longer produces this output`
      )
    else if (actual !== digest)
      problems.push(
        `${workflowKey} ${key}: output hash changed - expected ${digest}, got ` +
          `${actual}. A frontend change altered what this workflow produces ` +
          provenance
      )
  }
  for (const key of Object.keys(observed))
    if (!(key in expected))
      problems.push(
        `${workflowKey} ${key}: new output with no committed hash - enroll it ` +
          `(a new output appearing is also a behavior change)`
      )
  return problems
}
