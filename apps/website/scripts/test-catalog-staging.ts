import { readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const website = 'http://127.0.0.1:4349'
const credentialFile = process.env.CCC_STAGING_TEST_CREDENTIAL_FILE
if (!credentialFile)
  throw new Error('Private local publisher credential filepath required')
const credential = (await readFile(credentialFile, 'utf8')).trim()
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  })
  expect((await context.request.get(`${website}/admin/catalog`)).status()).toBe(
    404
  )
  expect(
    (
      await context.request.post(`${website}/admin/content-session`, {
        headers: { Origin: website, Authorization: `Bearer ${credential}` }
      })
    ).status()
  ).toBe(204)
  const csrf = (await context.cookies()).find(
    (entry) => entry.name === 'comfy_catalog_csrf'
  )?.value
  if (!csrf) throw new Error('Verified local session missing CSRF')
  const tag = `bruce-staging-demo-${Date.now()}`
  const created = await context.request.post(
    `${website}/admin/content-api/save`,
    {
      headers: {
        Origin: website,
        'X-Comfy-CSRF': csrf,
        'Idempotency-Key': tag
      },
      data: {
        type: 'workflow',
        schema_version: 1,
        expected_draft_rev: 2,
        title: 'BRUCE staging demo — local fixture',
        slug: tag,
        description:
          'Disabled staff-only fixture for actual staging UI verification.',
        enabled: false,
        visibility: 'staff',
        available_surfaces: ['hub'],
        tags: [tag],
        use_cases: [],
        inputs: {},
        inputSchema: { type: 'object', properties: {} },
        examples: []
      }
    }
  )
  expect(created.status()).toBe(201)
  const fixture = await created.json()
  expect(typeof fixture.uid).toBe('string')
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.name))
  await page.goto(`${website}/admin/catalog?search=${fixture.uid}`)
  await expect(
    page.getByRole('heading', { name: 'Draft changes' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'BRUCE staging demo — local fixture Added'
    })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Approve all matching' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText(fixture.uid)
  await page.getByRole('button', { name: 'Confirm decision' }).click()
  await expect(
    page.getByText('Decisions saved. Live content is unchanged.')
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', {
      name: 'Decision for BRUCE staging demo — local fixture'
    })
  ).toHaveValue('APPROVED')
  await page
    .getByRole('combobox', {
      name: 'Decision for BRUCE staging demo — local fixture'
    })
    .selectOption('DEFERRED')
  await expect(page.getByRole('dialog')).toContainText('1 matching changes')
  await page.getByRole('button', { name: 'Confirm decision' }).click()
  await expect(
    page.getByRole('combobox', {
      name: 'Decision for BRUCE staging demo — local fixture'
    })
  ).toHaveValue('DEFERRED')
  await page.reload()
  await expect(
    page.getByRole('combobox', {
      name: 'Decision for BRUCE staging demo — local fixture'
    })
  ).toHaveValue('DEFERRED')
  await page.screenshot({
    path: '/tmp/ccc-bruce-staging-demo.png',
    fullPage: true
  })
  const detail = await context.request.get(
    `${website}/admin/content-api/item?uid=${fixture.uid}`
  )
  expect(detail.status()).toBe(200)
  const current = await detail.json()
  const {
    uid,
    revision_uid,
    catalog_rev,
    edit_sequence,
    digest,
    owner_uid,
    author_uid,
    saved_by_uid,
    is_deleted,
    draft_generation,
    ...authored
  } = current
  expect(uid).toBe(fixture.uid)
  const edited = await context.request.post(
    `${website}/admin/content-api/save`,
    {
      headers: {
        Origin: website,
        'X-Comfy-CSRF': csrf,
        'Idempotency-Key': `${tag}-stale-save`
      },
      data: {
        ...authored,
        uid,
        description: 'A new exact save must invalidate the old staged decision.'
      }
    }
  )
  expect(edited.status()).toBe(200)
  await page.getByRole('button', { name: 'Approve all matching' }).click()
  await page.getByRole('button', { name: 'Confirm decision' }).click()
  await expect(page.getByRole('alert')).toContainText('This review is stale')
  await expect(
    page.getByRole('button', { name: 'Approve all matching' })
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Apply filters / reload' }).click()
  await expect(
    page.getByRole('combobox', {
      name: 'Decision for BRUCE staging demo — local fixture'
    })
  ).toHaveValue('NEW')
  await expect(
    page.getByRole('button', { name: 'Approve all matching' })
  ).toBeEnabled()
  expect(
    (
      await context.request.post(`${website}/admin/catalog-api/staging`, {
        headers: {
          Origin: 'https://attacker.invalid',
          'X-Comfy-CSRF': csrf,
          'Idempotency-Key': 'staging-csrf-refusal'
        },
        data: {}
      })
    ).status()
  ).toBe(403)
  await page.goto(`${website}/admin/catalog/final-review`)
  await expect(page.getByRole('alert')).toContainText('Final review is blocked')
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true })
  ).toBeDisabled()
  expect(errors).toEqual([])
  console.log(
    JSON.stringify({
      website,
      fixture_uid: fixture.uid,
      authenticated_staging: true,
      approved: true,
      deferred: true,
      reload_persisted: true,
      stale_conflict: true,
      csrf_refusal: true,
      final_review_blocked_safely: true,
      publish_available: false,
      browser_errors: errors.length
    })
  )
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.slice(0, 1800)
      : 'Local staging verification failed'
  )
  process.exitCode = 1
} finally {
  await browser.close()
}
