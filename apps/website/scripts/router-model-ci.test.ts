import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, matchesGlob } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { z } from 'zod'

import { websiteTestScope } from '../testing/models-test-scope'

const filters = parseDocument(
  readFileSync(
    join(import.meta.dirname, '../../../.github/filters/models.yaml'),
    'utf8'
  )
)
const modelPaths = z
  .object({ models: z.array(z.string()) })
  .parse(filters.toJSON()).models
const workflow = parseDocument(
  readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/ci-models.yaml'),
    'utf8'
  )
)
const gate = z
  .string()
  .parse(workflow.getIn(['jobs', 'models-gate', 'steps', 0, 'run']))

describe('MODELS CI change selection', () => {
  it.for([
    { value: undefined, expected: 'all' },
    { value: 'all', expected: 'all' },
    { value: 'models', expected: 'models' },
    { value: 'website', expected: 'website' }
  ])('selects $expected for $value', ({ value, expected }) => {
    expect(websiteTestScope(value)).toBe(expected)
  })

  it.for(['', 'model', 'webiste'])('rejects an unknown scope %s', (value) => {
    expect(() => websiteTestScope(value)).toThrow('Unknown WEBSITE_TEST_SCOPE')
  })

  it.for([
    'apps/website/src/config/workshop-playground.ts',
    'apps/website/src/data/workshop-model-availability.json',
    'apps/website/src/content/workshop-router-contracts.json',
    'apps/website/src/content/workshop-display.content.test.ts',
    'apps/website/src/data/modelDiscovery.test.ts',
    'apps/website/src/pages/index.astro',
    'apps/website/src/pages/zh-CN/index.astro',
    'apps/website/src/routes/models/[slug].astro',
    'apps/website/src/components/workshop/PlaygroundField.vue',
    'apps/website/src/components/home/ModelDiscoverySection.vue',
    'apps/website/src/components/common/HeaderMain/HeaderMain.vue',
    'apps/website/src/styles/global.css',
    'apps/website/src/i18n/translations.ts',
    'apps/website/src/config/auth-sign-in-state.ts',
    'apps/website/src/pages/login/index.astro',
    'apps/website/src/pages/login.astro',
    'apps/website/scripts/router-model-validation.test.ts',
    'apps/website/scripts/script-entry-point.ts',
    'apps/website/scripts/python-source-parser.ts',
    'apps/website/public/hero/input.webp',
    'apps/website/public/fonts/PPFormula-CondensedBold.woff2',
    'apps/website/public/icons/ai-models/flux.svg',
    'apps/website/e2e/workshop-input-validation.spec.ts',
    'apps/website/e2e/fixtures/workshopAuth.ts',
    'apps/website/testing/models-test-scope.ts',
    'packages/account-core/src/session.ts',
    'packages/tailwind-utils/src/index.ts',
    '.github/workflows/ci-models.yaml',
    '.github/filters/models.yaml',
    'pnpm-lock.yaml'
  ])('runs for %s', (file) => {
    expect(modelPaths.some((pattern) => matchesGlob(file, pattern))).toBe(true)
  })

  it.for([
    'src/components/graph/GraphCanvas.vue',
    'apps/billing-web/src/App.vue',
    'apps/website/src/pages/careers/index.astro',
    'apps/website/src/components/careers/HeroSection.vue',
    'apps/website/src/data/ashby-roles.snapshot.json',
    'apps/website/src/pages/affiliates/index.astro',
    'apps/website/src/data/affiliateFaq.ts',
    'apps/website/e2e/careers.spec.ts',
    'docs/guidance/engineering.md',
    'README.md'
  ])('skips %s', (file) => {
    expect(modelPaths.some((pattern) => matchesGlob(file, pattern))).toBe(false)
  })
})

describe('MODELS required verdict', () => {
  it.for([
    { filter: 'success', changed: 'true', checks: 'success', exit: 0 },
    { filter: 'success', changed: 'false', checks: 'skipped', exit: 0 },
    { filter: 'success', changed: 'true', checks: 'failure', exit: 1 },
    { filter: 'success', changed: 'true', checks: 'cancelled', exit: 1 },
    { filter: 'success', changed: 'true', checks: 'skipped', exit: 1 },
    { filter: 'success', changed: '', checks: 'skipped', exit: 1 },
    { filter: 'failure', changed: 'false', checks: 'skipped', exit: 1 },
    { filter: 'cancelled', changed: '', checks: 'skipped', exit: 1 }
  ])(
    'filter=$filter changed=$changed checks=$checks exits $exit',
    ({ filter, changed, checks, exit }) => {
      const result = spawnSync('bash', ['-e', '-c', gate], {
        encoding: 'utf8',
        env: {
          ...process.env,
          FILTER_RESULT: filter,
          MODELS_CHANGED: changed,
          CHECKS_RESULT: checks,
          GITHUB_STEP_SUMMARY: '/dev/null'
        }
      })
      expect(result.status).toBe(exit)
    }
  )
})
