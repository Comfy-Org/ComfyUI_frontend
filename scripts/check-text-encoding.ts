/**
 * Fails a commit that stages a source file containing a raw NUL byte.
 *
 * A NUL is what makes git classify a file as binary. It then renders as
 * `Binary files /dev/null and b/... differ`, so every line of the file is
 * invisible to the diff, to code review, and to grep-based audits. The remedy
 * is always the same — write the byte as a unicode escape (`'\u0000'`).
 *
 * Only NUL, deliberately. Other control bytes are not always a mistake —
 * `tools/test-recorder/src/ui/logger.test.ts` embeds a real ESC to measure the
 * display width of an ANSI colour code — and none of them costs the file its
 * diff.
 *
 * Git's own heuristic inspects only the first 8000 bytes, so a NUL further
 * into a file leaves it *looking* reviewable while still breaking greps and
 * editors. This check reads whole files.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Extensions that must hold reviewable text. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.astro',
  '.css',
  '.scss',
  '.json',
  '.jsonc',
  '.md',
  '.yaml',
  '.yml',
  '.html',
  '.py',
  '.sh'
])

const NUL = 0x00

export interface NulByteOffence {
  path: string
  /** 1-based line the byte sits on. */
  line: number
  byte: number
  offset: number
}

export function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extname(path))
}

/** The first NUL byte in `contents`, or `undefined`. */
export function findNulByte(
  path: string,
  contents: Uint8Array
): NulByteOffence | undefined {
  let line = 1
  for (const [offset, byte] of contents.entries()) {
    if (byte === 0x0a) {
      line++
      continue
    }
    if (byte === NUL) return { path, line, byte, offset }
  }
  return undefined
}

export function formatOffences(offences: readonly NulByteOffence[]): string {
  const rows = offences.map(({ path, line, byte, offset }) => {
    const code = `0x${byte.toString(16).padStart(2, '0')}`
    return `  ${path}:${line} — byte ${code} at offset ${offset}`
  })
  return [
    'Raw NUL bytes in source text. Git renders these files as binary, so the diff hides every line:',
    ...rows,
    '',
    "Write the byte as a unicode escape instead, e.g. '\\u0000'."
  ].join('\n')
}

/**
 * Git's default pathname quoting turns a non-ASCII name into
 * `"review-\303\251.ts"`, whose trailing quote costs it its extension, and it
 * splits a name containing a newline across two lines. Both make a file
 * silently unchecked, so every path listing is NUL-delimited.
 */
function gitTextPaths(args: readonly string[]): string[] {
  const out = execFileSync('git', [...args, '-z'], { encoding: 'utf8' })
  return out.split('\0').filter(Boolean).filter(isTextPath)
}

/** The bytes a commit would record for a staged path. */
function readStagedBytes(path: string): Uint8Array {
  return execFileSync('git', ['show', `:0:${path}`], {
    maxBuffer: Number.MAX_SAFE_INTEGER
  })
}

/**
 * `--all` walks every tracked text file; the default walks the staged ones.
 *
 * CI needs `--all`: nothing is staged there, so a staged-only check would pass
 * vacuously — and a hook is bypassable besides, which is how the defect this
 * guards reached review in the first place.
 *
 * The two modes read different bytes on purpose. A hook must judge what the
 * commit will record, so it reads the index: a staged NUL with an unstaged
 * correction is still a NUL in the commit. `--all` has no index entries to
 * read and judges the checkout.
 */
function checkPaths(all: boolean): NulByteOffence[] {
  if (!all) {
    const staged = gitTextPaths([
      'diff',
      '--cached',
      '--name-only',
      '--diff-filter=ACMR'
    ])
    return staged.flatMap((path) => {
      const offence = findNulByte(path, readStagedBytes(path))
      return offence ? [offence] : []
    })
  }

  return gitTextPaths(['ls-files']).flatMap((path) => {
    // A tracked file deleted in the worktree is not ours to read.
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return []
    const offence = findNulByte(path, readFileSync(path))
    return offence ? [offence] : []
  })
}

/** Git's own message, which carries the reason; the wrapper's does not. */
function errorText(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'stderr' in error) {
    const { stderr } = error
    if (typeof stderr === 'string' && stderr) return stderr.trim()
    if (stderr instanceof Uint8Array && stderr.length) {
      return Buffer.from(stderr).toString('utf8').trim()
    }
  }
  return error instanceof Error ? error.message : String(error)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  let offences: NulByteOffence[]
  try {
    offences = checkPaths(process.argv.includes('--all'))
  } catch (error) {
    // No failure is tolerated. A broken `git`, a missing repository or an
    // unreadable blob all leave files unscanned, and a check that could not
    // scan must not look like one that found nothing — in CI that turns the
    // step green over an unchecked tree. Both callers run from inside the
    // repository, so there is no benign case left to excuse.
    process.stderr.write(`Text-encoding check failed: ${errorText(error)}\n`)
    process.exit(1)
  }
  if (offences.length) {
    process.stderr.write(`${formatOffences(offences)}\n`)
    process.exit(1)
  }
}
