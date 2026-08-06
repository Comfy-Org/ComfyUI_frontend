/**
 * Rewrites the implemented-capability list in `docs/node_api_WIP.md` from
 * `CAPABILITIES` in comfyApi.ts.
 *
 *   node scripts/magic-patch/gen_capability_list.mjs [--check]
 *
 * Hand-maintaining that list cost a whole conversion run: the doc said eleven
 * capabilities while the code had eighteen, so agents read `widgets.mount`,
 * `widgets.canvas`, `setSizeConstraints` and `defs.define` as unimplemented and
 * punted twelve files against capabilities that were sitting right there. The
 * banner exists to stop conversions against unbuilt API; stale, it does the
 * opposite and is far more expensive.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const API = new URL('../../src/platform/nodeApi/comfyApi.ts', import.meta.url)
  .pathname
const DOC = new URL('../../docs/node_api_WIP.md', import.meta.url).pathname
const START = '> **Implemented (v1.0):**'
const END = '> **Specified only:**'

export function implementedCapabilities() {
  const source = readFileSync(API, 'utf8')
  const block = /const CAPABILITIES[\s\S]*?\n\]\)/.exec(source)?.[0] ?? ''
  return [...block.matchAll(/\[\s*'([^']+)'/g)].map((m) => m[1]).sort()
}

function render(names) {
  const line = names.map((n) => `\`${n}\``).join(', ')
  // Wrapped to the doc's width, each line prefixed as a blockquote.
  const out = []
  let current = `${START} `
  for (const part of line.split(', ')) {
    if (`${current}${part}, `.length > 78) {
      out.push(current.trimEnd())
      current = '> '
    }
    current += `${part}, `
  }
  out.push(current.trimEnd().replace(/,$/, '.'))
  return out.join('\n')
}

const doc = readFileSync(DOC, 'utf8')
const from = doc.indexOf(START)
const to = doc.indexOf(END)
if (from === -1 || to === -1) {
  console.error(`Could not find the capability block in ${DOC}`)
  process.exit(2)
}
const next = doc.slice(0, from) + render(implementedCapabilities()) + '\n>\n' + doc.slice(to)

if (process.argv.includes('--check')) {
  if (next !== doc) {
    console.error(
      'docs/node_api_WIP.md lists different capabilities than CAPABILITIES.\n' +
        'Run: node scripts/magic-patch/gen_capability_list.mjs'
    )
    process.exit(1)
  }
  console.error(`capability list is current (${implementedCapabilities().length})`)
} else {
  writeFileSync(DOC, next)
  console.error(`wrote ${implementedCapabilities().length} capabilities`)
}
