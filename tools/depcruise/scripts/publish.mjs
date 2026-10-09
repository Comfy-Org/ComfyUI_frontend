// Deploys this report to the ComfyUI Vercel team as a members-only site,
// optionally regenerating the snapshot first.
//
//   node scripts/publish.mjs                      preview deploy of current data
//                                                 (a new project's first deploy
//                                                 is always production)
//   node scripts/publish.mjs --prod               production deploy
//   node scripts/publish.mjs --base <sha> --head <sha> [--prod]
//                                                 regenerate, then deploy
//
// Run from the repo root after `pnpm dlx vercel@62 login`. Regenerating needs
// Graphviz (`sfdp`) on PATH. The deploy is refused unless the project's
// Vercel Authentication covers every deployment.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const TEAM = 'comfyui'
const PROJECT = 'gordian-knot-comfyui'
const VERCEL = ['dlx', 'vercel@62']
const PROTECTION = { deploymentType: 'all' }

const scripts = dirname(fileURLToPath(import.meta.url))
const site = join(scripts, '..')
const { values: args } = parseArgs({
  options: {
    prod: { type: 'boolean', default: false },
    base: { type: 'string' },
    head: { type: 'string' }
  }
})

const log = (...parts) => process.stdout.write(`${parts.join(' ')}\n`)

const run = (cmd, cmdArgs, options = {}) =>
  execFileSync(cmd, cmdArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options
  }).trim()

function api(path, method, body) {
  const extra = []
  const bodyFile = join(tmpdir(), `${PROJECT}-body.json`)
  if (body) {
    writeFileSync(bodyFile, JSON.stringify(body))
    extra.push('--input', bodyFile)
  }
  try {
    const out = run(
      'pnpm',
      [...VERCEL, 'api', path, '-X', method, '--scope', TEAM, ...extra],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    return JSON.parse(out.slice(out.indexOf('{')))
  } finally {
    rmSync(bodyFile, { force: true })
  }
}

if (Boolean(args.base) !== Boolean(args.head)) {
  console.error('Pass both --base and --head, or neither.')
  process.exit(1)
}
if (args.base) {
  const work = join(tmpdir(), `${PROJECT}-work`)
  rmSync(work, { recursive: true, force: true })
  const node = (script, ...rest) =>
    execFileSync(process.execPath, [join(scripts, script), ...rest], {
      stdio: 'inherit'
    })
  node('cruise.mjs', args.base, args.head, work)
  node('open-prs.mjs', work, args.head)
  node('census.mjs', work)
  node('build-data.mjs', work)
  rmSync(work, { recursive: true, force: true })
}

let project
try {
  project = api(`/v9/projects/${PROJECT}`, 'GET')
} catch {
  log(`Creating Vercel project ${TEAM}/${PROJECT}`)
  project = api('/v10/projects', 'POST', { name: PROJECT })
}
if (project.ssoProtection?.deploymentType !== PROTECTION.deploymentType) {
  project = api(`/v9/projects/${PROJECT}`, 'PATCH', {
    ssoProtection: PROTECTION
  })
}
if (project.ssoProtection?.deploymentType !== PROTECTION.deploymentType) {
  console.error(
    'Refusing to deploy: the project is not limited to team members.',
    JSON.stringify(project.ssoProtection)
  )
  process.exit(1)
}

mkdirSync(join(site, '.vercel'), { recursive: true })
writeFileSync(
  join(site, '.vercel', 'project.json'),
  JSON.stringify({ projectId: project.id, orgId: project.accountId })
)

const url = run(
  'pnpm',
  [
    ...VERCEL,
    'deploy',
    '--yes',
    '--scope',
    TEAM,
    ...(args.prod ? ['--prod'] : [])
  ],
  { cwd: site }
)
  .match(/https:\/\/[^\s",]+/g)
  .at(-1)

const status = await fetch(url, { redirect: 'manual' }).then((r) => r.status)
log(`Deployed ${args.prod ? 'production' : 'preview'}: ${url}`)
log(
  status === 200
    ? 'WARNING: the deployment answers 200 without signing in.'
    : `Signed-out request answers ${status}, so the site is members-only.`
)
log(`Local copy: ${pathToFileURL(join(site, 'index.html'))}`)
