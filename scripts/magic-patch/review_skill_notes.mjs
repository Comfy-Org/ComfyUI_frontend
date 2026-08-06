/**
 * Collects the skill additions agents proposed while converting.
 *
 *   tsx scripts/magic-patch/review_skill_notes.mjs <db-dir>...
 *
 * Deliberately a report rather than an auto-apply. A tip earns its place in the
 * skill by holding beyond the pack that produced it, and one agent's surprise
 * is often just that pack's oddity — folding every note in automatically would
 * grow the skill faster than it improves it, and the skill's value is that it
 * is short enough to be read.
 *
 * Notes repeated across packs are listed first, because independent
 * rediscovery is the strongest signal that something is missing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function ledgers(dir, depth = 0) {
  if (depth > 12) return []
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

export function collectNotes(dirs) {
  const notes = []
  for (const dir of dirs) {
    for (const path of ledgers(dir)) {
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          for (const note of entry.skillNotes ?? []) {
            notes.push({ ...note, pack: entry.pack })
          }
        } catch {
          // A truncated final line is normal for a run that was interrupted.
        }
      }
    }
  }
  return notes
}

/** Groups near-identical claims so repeated discoveries surface together. */
function cluster(notes) {
  const key = (claim) =>
    claim
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6)
      .sort()
      .join(' ')

  const groups = new Map()
  for (const note of notes) {
    const k = key(note.claim)
    const existing = groups.get(k) ?? { claim: note.claim, notes: [] }
    existing.notes.push(note)
    groups.set(k, existing)
  }
  return [...groups.values()].sort((a, b) => b.notes.length - a.notes.length)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dirs = process.argv.slice(2)
  if (!dirs.length) {
    console.error('usage: review_skill_notes.mjs <db-dir>...')
    process.exit(2)
  }

  const notes = collectNotes(dirs)
  if (!notes.length) {
    console.error('No skill notes proposed.')
    process.exit(0)
  }

  const groups = cluster(notes)
  console.error(
    `${notes.length} note(s) from ${new Set(notes.map((n) => n.pack)).size} pack(s), ` +
      `${groups.length} distinct claim(s)\n`
  )
  for (const [index, group] of groups.entries()) {
    const packs = [...new Set(group.notes.map((n) => n.pack))]
    const references = [...new Set(group.notes.map((n) => n.reference))]
    console.error(
      `${index + 1}. [x${group.notes.length}] ${references.join(', ')}\n` +
        `   ${group.claim}\n` +
        `   packs: ${packs.join(', ')}\n` +
        `   evidence: ${group.notes[0].evidence.slice(0, 200)}\n`
    )
  }
  console.error(
    'Fold in the repeated ones first: independent rediscovery is the signal.'
  )
}
