// Lists the open pull requests carrying the gordian-knot label, fetches their
// heads, records where each forks from main, and cruises every head and fork
// point. Writes <work>/open-prs.json and <work>/states/<sha>.json.
//
//   node scripts/open-prs.mjs <workDir> [mainRef]
//
// Run from the repo root; needs an authenticated `gh`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'Comfy-Org/ComfyUI_frontend'
const LABEL = 'refactor-gordian-knot'
const FIELDS =
  'number,title,url,author,isDraft,mergeable,reviewDecision,additions,deletions,changedFiles,baseRefName,headRefName,headRefOid'

const [, , workArg, mainRef = 'main'] = process.argv
if (!workArg) {
  console.error('usage: open-prs.mjs <workDir> [mainRef]')
  process.exit(1)
}
const work = resolve(workArg)
const out = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

const prs = JSON.parse(
  out('gh', [
    'pr',
    'list',
    '--repo',
    REPO,
    '--label',
    LABEL,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    FIELDS
  ])
)
out('git', [
  'fetch',
  '--quiet',
  'origin',
  ...prs.map((pr) => `pull/${pr.number}/head`)
])

const main = out('git', ['rev-parse', mainRef])
for (const pr of prs) {
  pr.author = pr.author.login
  pr.mergeBase = out('git', ['merge-base', pr.headRefOid, main])
  pr.behindMain = Number(
    out('git', ['rev-list', '--count', `${pr.mergeBase}..${main}`])
  )
}

const isAncestor = (ancestor, descendant) => {
  try {
    out('git', ['merge-base', '--is-ancestor', ancestor, descendant])
    return true
  } catch {
    return false
  }
}
const byHeadRef = new Map(prs.map((pr) => [pr.headRefName, pr]))
for (const pr of prs) {
  const below = byHeadRef.get(pr.baseRefName)
  pr.containsParentHead = !below || isAncestor(below.headRefOid, pr.headRefOid)
}

mkdirSync(work, { recursive: true })
writeFileSync(
  join(work, 'open-prs.json'),
  JSON.stringify(
    { label: LABEL, fetchedAt: new Date().toISOString(), main, prs },
    null,
    2
  )
)

const shas = [...new Set(prs.flatMap((pr) => [pr.headRefOid, pr.mergeBase]))]
execFileSync(
  process.execPath,
  [
    join(dirname(fileURLToPath(import.meta.url)), 'cruise.mjs'),
    '--shas',
    shas.join(','),
    work
  ],
  { stdio: 'inherit' }
)
