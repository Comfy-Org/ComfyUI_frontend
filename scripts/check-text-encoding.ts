/**
 * Fails a commit that stages a source file containing a raw NUL byte.
 *
 * A NUL is what makes git classify a file as binary. It then renders as
 * `Binary files /dev/null and b/... differ`, so every line of the file is
 * invisible to the diff, to code review, and to grep-based audits.
 * `src/lib/litegraph/src/utils/widgetIdentity.ts` shipped that way on
 * PR #19717: one raw NUL used as a lookup-key separator hid the whole module,
 * including all of its validation of an untrusted document field. The remedy
 * is always the same — write the byte as a unicode escape (`'\u0000'`).
 *
 * Only NUL, deliberately. Other control bytes are not always a mistake —
 * `tools/test-recorder/src/ui/logger.test.ts` embeds a real ESC to measure the
 * display width of an ANSI colour code — and none of them costs the file its
 * diff.
 *
 * Git's own heuristic inspects only the first 8000 bytes, so a NUL further
 * into a file leaves it *looking* reviewable while still breaking greps and
 * editors. The companion test file on that same PR was in exactly that state,
 * which is why this check reads whole files.
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

function gitTextPaths(args: readonly string[]): string[] {
  const out = execFileSync('git', [...args], { encoding: 'utf8' })
  return out.split('\n').filter(Boolean).filter(isTextPath)
}

/**
 * `--all` walks every tracked text file; the default walks the staged ones.
 *
 * CI needs `--all`: nothing is staged there, so a staged-only check would pass
 * vacuously — and a hook is bypassable besides, which is how the defect this
 * guards reached review in the first place.
 */
function checkPaths(all: boolean): NulByteOffence[] {
  const paths = all
    ? gitTextPaths(['ls-files'])
    : gitTextPaths(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  return paths.flatMap((path) => {
    // Renamed-away, submodule or otherwise absent paths are not ours to read.
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return []
    const offence = findNulByte(path, readFileSync(path))
    return offence ? [offence] : []
  })
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  let offences: NulByteOffence[]
  try {
    offences = checkPaths(process.argv.includes('--all'))
  } catch (error) {
    // A missing git index is not a reason to block a commit.
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Text-encoding check skipped: ${message}\n`)
    process.exit(0)
  }
  if (offences.length) {
    process.stderr.write(`${formatOffences(offences)}\n`)
    process.exit(1)
  }
}
