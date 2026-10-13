import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { z } from 'zod'

import { catalogDeliveryPlan } from './catalog-delivery-policy'

const eventSchema = z.object({
  pull_request: z
    .object({
      base: z.object({ sha: z.string() }),
      head: z.object({
        ref: z.string(),
        repo: z.object({ full_name: z.string() })
      })
    })
    .optional(),
  merge_group: z.object({ base_sha: z.string() }).optional(),
  before: z.string().optional()
})

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function run() {
  const { values } = parseArgs({ options: { base: { type: 'string' } } })
  const event = eventSchema.parse(
    process.env.GITHUB_EVENT_PATH
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      : {}
  )
  const base =
    values.base ??
    event.merge_group?.base_sha ??
    event.pull_request?.base.sha ??
    event.before
  if (!base || /^0+$/.test(base))
    throw new Error(
      'Catalog delivery requires a base revision (--base or event)'
    )
  const comparisonBase = event.pull_request
    ? git('merge-base', base, 'HEAD')
    : base
  const paths = git(
    'diff',
    '--name-status',
    '-z',
    '--no-renames',
    comparisonBase
  )
    .split('\0')
    .filter(Boolean)
  const changes = Array.from({ length: paths.length / 2 }, (_, index) => ({
    status: paths[index * 2],
    path: paths[index * 2 + 1]
  }))
  const versionSchema = z.object({ version: z.string() })
  const plan = catalogDeliveryPlan({
    branch: event.pull_request?.head.ref ?? '',
    sameRepository:
      event.pull_request?.head.repo.full_name === process.env.GITHUB_REPOSITORY,
    changed: changes.map(({ path }) => path),
    added: changes
      .filter(({ status }) => status === 'A')
      .map(({ path }) => path),
    versionChanged:
      versionSchema.parse(
        JSON.parse(git('show', `${comparisonBase}:package.json`))
      ).version !==
      versionSchema.parse(JSON.parse(readFileSync('package.json', 'utf8')))
        .version,
    appRegistry: readFileSync('src/locales/localeConfig.ts', 'utf8'),
    previousAppRegistry: git(
      'show',
      `${comparisonBase}:src/locales/localeConfig.ts`
    ),
    websiteRegistry: readFileSync('apps/website/src/config/locales.ts', 'utf8'),
    previousWebsiteRegistry: git(
      'show',
      `${comparisonBase}:apps/website/src/config/locales.ts`
    )
  })
  for (const [target, locales] of Object.entries(plan)) {
    if (!locales) continue
    const scope = locales === 'all' ? [] : [`--locales=${locales.join(',')}`]
    console.log(`Checking complete ${target} catalogs (${locales})`)
    execFileSync(
      'pnpm',
      ['locale:check', `--target=${target}`, '--complete', ...scope],
      { stdio: 'inherit' }
    )
  }
  if (!plan.app && !plan.website)
    console.log('Catalogs may use English fallback until translation delivery.')
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
