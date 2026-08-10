/**
 * Builds the published API's type surface as a single `.d.ts`.
 *
 * Dropped into every working copy as `v2/comfy-api.d.ts`, so an agent reads the
 * contract it is coding against instead of a prose list of capability names.
 * The prose list drifted — the doc said eleven capabilities while the code had
 * eighteen, and twelve files were punted against API that already existed.
 * Types cannot drift: they are the thing being described.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = new URL('../../src/platform/nodeApi/', import.meta.url).pathname

/** Exported interfaces and type aliases, with their doc comments. */
function declarations(source) {
  const out = []
  // Interfaces run to the closing brace at column 0. They must NOT stop at a
  // blank line: members are grouped with blank lines between them, and treating
  // one as the end silently truncated the declaration — NodeHandle lost
  // getProperty/setProperty and everything after, so agents refused files as
  // "no destination" against API that exists.
  const patterns = [
    /(\/\*\*[\s\S]*?\*\/\n)?export (interface) (\w+)[\s\S]*?\n\}/g,
    /(\/\*\*[\s\S]*?\*\/\n)?export (type) (\w+)[\s\S]*?(?:\n(?=\n)|$)/g
  ]
  for (const match of patterns.flatMap((p) => [...source.matchAll(p)])) {
    const [text, , kind, name] = match
    // Internal plumbing the pack never names.
    if (/^(Raw|Registration|Bound)/.test(name)) continue
    out.push({ name, kind, text: text.trimEnd() })
  }
  return out
}

export function buildApiDts() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()

  const sections = []
  for (const file of files) {
    const found = declarations(readFileSync(join(DIR, file), 'utf8'))
    if (!found.length) continue
    sections.push(
      `// ─── ${file} ${'─'.repeat(Math.max(0, 60 - file.length))}\n\n` +
        found.map((d) => d.text).join('\n\n')
    )
  }

  return (
    `/**\n` +
    ` * The published ComfyUI custom-node API — the complete surface.\n` +
    ` *\n` +
    ` * Generated from src/platform/nodeApi. If a member is not here it does not\n` +
    ` * exist: do not call it, and punt as api-gap naming what is missing.\n` +
    ` * Reached from a converted pack as:\n` +
    ` *\n` +
    ` *   import { comfy } from '/comfy/api/v2.js'\n` +
    ` */\n\n` +
    sections.join('\n\n')
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(buildApiDts())
}
