/**
 * What the API is still missing, and which packs are waiting on it.
 *
 *   tsx scripts/magic-patch/gap_report.mjs <db-dir>...
 *
 * Mined from the ledgers rather than maintained by hand: every api-gap punt is
 * an agent that read a real file, looked for a destination and did not find
 * one. That is the most reliable signal available about what to build next,
 * and a hand-kept list would drift from it within a week.
 *
 * Ranked by how many distinct packs hit each gap. One pack needing something is
 * a request; six unrelated packs needing the same thing is a missing feature.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Named capabilities to look for in punt prose.
 *
 * Matching on the API surface the agent named, rather than on its wording,
 * because the same gap gets described differently every time.
 */
const CAPABILITIES = [
  ['addDOMWidget', /\baddDOMWidget\b|DOM[- ]mount|DOM widget/i],
  ['defs.define', /\bregisterCustomNodes\b|\bdefs\.define\b|\bisVirtualNode\b/i],
  ['node.setSizeConstraints', /\bcomputeSize\b|\bonResize\b|\bsetSizeConstraints\b/i],
  ['dynamic slots', /\baddInput\b|\bremoveInput\b|\baddOutput\b|\bremoveOutput\b/i],
  ['button widget', /addWidget\(\s*["'`]button|\bbutton widget/i],
  ['canvas drawing', /\bonDrawForeground\b|\bonDrawBackground\b/i],
  ['pointer events', /\bonMouseDown\b|\bonMouseMove\b|\bonMouseLeave\b|\bpointer event/i],
  ['app.extensionManager', /\bextensionManager\b|\bsidebar\b|\bregisterSidebarTab\b/i],
  ['settings', /\bsetting\??\.get\b|\baddSetting\b|Comfy\.Locale/i],
  ['graphToPrompt', /\bgraphToPrompt\b|\bqueuePrompt\b|prompt intercept/i],
  ['serialization', /\bserializeValue\b|\bwidgets_values\b|\bonSerialize\b/i],
  ['cross-node writes', /other pack|another node|elsewhere in the graph/i],
  ['api events', /\baddEventListener\b|\bfetchApi\b/i]
]

function ledgers(dir, depth = 0) {
  if (depth > 8) return []
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const path = join(dir, name)
    try {
      if (statSync(path).isDirectory()) return ledgers(path, depth + 1)
      return name === 'ledger.jsonl' ? [path] : []
    } catch {
      return []
    }
  })
}

export function collectGaps(dirs) {
  const gaps = new Map()
  const packs = new Map()

  for (const dir of dirs) {
    for (const path of ledgers(dir)) {
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line.trim()) continue
        let entry
        try {
          entry = JSON.parse(line)
        } catch {
          continue
        }
        const files = entry.files ?? []
        packs.set(entry.pack, {
          pack: entry.pack,
          files: files.length,
          converted: files.filter((f) => f.status === 'converted').length,
          blocked: files.filter((f) => f.reason === 'api-gap').length,
          incompatible: files.filter((f) => f.reason === 'incompatible').length
        })

        for (const file of files) {
          if (file.status !== 'abandoned') continue
          const text = file.detail ?? ''
          const matched = CAPABILITIES.filter(([, p]) => p.test(text)).map(
            ([name]) => name
          )
          for (const name of matched.length ? matched : ['unclassified']) {
            const gap = gaps.get(name) ?? { packs: new Set(), files: 0 }
            gap.packs.add(entry.pack)
            gap.files++
            gaps.set(name, gap)
          }
        }
      }
    }
  }
  return { gaps, packs }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dirs = process.argv.slice(2)
  if (!dirs.length) {
    console.error('usage: gap_report.mjs <db-dir>...')
    process.exit(2)
  }
  const { gaps, packs } = collectGaps(dirs)

  console.error('MISSING CAPABILITIES  (ranked by distinct packs blocked)\n')
  console.error('capability                 packs  files  blocked packs')
  for (const [name, gap] of [...gaps].sort(
    (a, b) => b[1].packs.size - a[1].packs.size || b[1].files - a[1].files
  )) {
    const list = [...gap.packs].sort().slice(0, 3).join(', ')
    const more = gap.packs.size > 3 ? ` +${gap.packs.size - 3}` : ''
    console.error(
      `${name.padEnd(26)} ${String(gap.packs.size).padStart(5)}  ${String(gap.files).padStart(5)}  ${list}${more}`
    )
  }

  console.error('\nPACKS SEEN\n')
  console.error('pack                                files  converted  blocked')
  for (const p of [...packs.values()].sort((a, b) => b.blocked - a.blocked)) {
    console.error(
      `${p.pack.slice(0, 34).padEnd(34)} ${String(p.files).padStart(5)}  ${String(p.converted).padStart(9)}  ${String(p.blocked).padStart(7)}`
    )
  }
}
