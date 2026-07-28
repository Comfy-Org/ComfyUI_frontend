import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

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
  filename: string
  subfolder: string
  type: string
}

function isFileRef(
  value: unknown
): value is { filename: string; subfolder?: string; type?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { filename?: unknown }).filename === 'string'
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
    if (ext === '.png')
      return { file: ext, pixels: hashPngPixels(await fetchFile(ref)) }
    return { file: ext }
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

export type CuratedOutputHashes = Record<string, Record<string, string>>

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
    : {}
  existing[workflowKey] = observed
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(existing, null, 2))
}

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
