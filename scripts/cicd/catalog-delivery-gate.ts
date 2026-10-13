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

function readEvent() {
  const event = eventSchema.parse(
    process.env.GITHUB_EVENT_PATH
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      : {}
  )
  return {
    ...event,
    before:
      process.env.GITHUB_EVENT_NAME === 'push' &&
      event.before === '0'.repeat(40)
        ? 'HEAD'
        : event.before
  }
}

function comparisonBase(event: z.infer<typeof eventSchema>, explicit?: string) {
  const selected = [
    explicit,
    event.merge_group?.base_sha,
    event.pull_request?.base.sha,
    event.before
  ].find((candidate) => candidate !== undefined)
  const base = z
    .string()
    .min(1)
    .refine(
      (revision) => !/^0+$/.test(revision),
      'Catalog delivery requires a base revision (--base or event)'
    )
    .parse(selected)
  return event.pull_request ? git('merge-base', base, 'HEAD') : base
}

function readDeliveryInput(event: z.infer<typeof eventSchema>, base: string) {
  const paths = git('diff', '--name-status', '-z', '--no-renames', base)
    .split('\0')
    .filter(Boolean)
  const changes = Array.from({ length: paths.length / 2 }, (_, index) => ({
    status: paths[index * 2],
    path: paths[index * 2 + 1]
  }))
  const versionSchema = z.object({ version: z.string() })
  return {
    branch: event.pull_request?.head.ref ?? '',
    sameRepository:
      event.pull_request?.head.repo.full_name === process.env.GITHUB_REPOSITORY,
    changed: changes.map(({ path }) => path),
    added: changes
      .filter(({ status }) => status === 'A')
      .map(({ path }) => path),
    versionChanged:
      versionSchema.parse(JSON.parse(git('show', `${base}:package.json`)))
        .version !==
      versionSchema.parse(JSON.parse(readFileSync('package.json', 'utf8')))
        .version,
    appRegistry: readFileSync('src/locales/localeConfig.ts', 'utf8'),
    previousAppRegistry: git('show', `${base}:src/locales/localeConfig.ts`),
    websiteRegistry: readFileSync('apps/website/src/config/locales.ts', 'utf8'),
    previousWebsiteRegistry: git(
      'show',
      `${base}:apps/website/src/config/locales.ts`
    )
  }
}

function validateDeliveries(plan: ReturnType<typeof catalogDeliveryPlan>) {
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
}

function run() {
  const { values } = parseArgs({ options: { base: { type: 'string' } } })
  const event = readEvent()
  const plan = catalogDeliveryPlan(
    readDeliveryInput(event, comparisonBase(event, values.base))
  )
  validateDeliveries(plan)
  if (!plan.app && !plan.website)
    console.log('Catalogs may use English fallback until translation delivery.')
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
