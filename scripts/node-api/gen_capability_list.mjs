/**
 * Rewrites the implemented-capability lists in the node API design and
 * reference docs from `CAPABILITIES` in comfyApi.ts.
 *
 *   node scripts/node-api/gen_capability_list.mjs [--check]
 *
 * Hand-maintaining that list cost a whole conversion run: the doc said eleven
 * capabilities while the code had eighteen, so agents read `widgets.mount`,
 * `widgets.canvas`, `setSizeConstraints` and `defs.define` as unimplemented and
 * punted twelve files against capabilities that were sitting right there. The
 * banner exists to stop conversions against unbuilt API; stale, it does the
 * opposite and is far more expensive.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const API = fileURLToPath(
  new URL('../../src/platform/nodeApi/comfyApi.ts', import.meta.url)
)
const REFERENCE_DOC = fileURLToPath(
  new URL('../../docs/node-api/reference.md', import.meta.url)
)
const REFERENCE_START = '<!-- node-api-capabilities:start -->'
const REFERENCE_END = '<!-- node-api-capabilities:end -->'

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

function renderReference(names) {
  const out = []
  let current = ''
  for (const name of names) {
    const part = `\`${name}\``
    if (`${current}${part}, `.length > 78) {
      out.push(current.trimEnd())
      current = ''
    }
    current += `${part}, `
  }
  out.push(current.trimEnd().replace(/,$/, '.'))
  return out.join('\n')
}

function updateReference(names) {
  const doc = readFileSync(REFERENCE_DOC, 'utf8')
  const from = doc.indexOf(REFERENCE_START)
  const to = doc.indexOf(REFERENCE_END)
  if (from === -1 || to === -1) {
    throw new Error(`Could not find the capability block in ${REFERENCE_DOC}`)
  }
  return {
    path: REFERENCE_DOC,
    source: doc,
    next:
      doc.slice(0, from + REFERENCE_START.length) +
      `\n\n${renderReference(names)}\n` +
      doc.slice(to)
  }
}

const names = implementedCapabilities()
let updates
try {
  updates = [updateReference(names)]
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(2)
}

if (process.argv.includes('--check')) {
  const stale = updates.filter(({ source, next }) => source !== next)
  if (stale.length) {
    console.error(
      `${stale.map(({ path }) => path).join(', ')} list different ` +
        'capabilities than CAPABILITIES.\n' +
        'Run: node scripts/node-api/gen_capability_list.mjs'
    )
    process.exit(1)
  }
  console.error(`capability lists are current (${names.length})`)
} else {
  for (const { path, next } of updates) writeFileSync(path, next)
  console.error(`wrote ${names.length} capabilities to ${updates.length} docs`)
}
