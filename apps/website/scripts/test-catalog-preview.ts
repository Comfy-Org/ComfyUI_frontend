import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Labeled LOCAL fixture only. Does not publish, stage other people's changes,
// alter grants or call paid execution/translation services.
const file = process.env.CCC_EDITOR_TEST_CREDENTIAL_FILE
if (!file)
  throw new Error('A private local fixture credential file is required')
const website = 'http://127.0.0.1:4349'
const backend = 'http://127.0.0.1:8109'
const credential = (await readFile(file, 'utf8')).trim()
const browser = await chromium.launch({ headless: true })
let phase = 'session'
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    serviceWorkers: 'block'
  })
  // Browser exercises only local application services. No remote generation.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === website || url.origin === backend)
      return route.continue()
    // Decorative CDN images are irrelevant to this local integration check.
    // Stub instead of aborting: the footer's animation intentionally reports
    // aborted image loads as page errors. Private catalog bytes remain real.
    if (route.request().resourceType() === 'image')
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
      })
    return route.abort()
  })
  expect(
    (
      await context.request.post(`${website}/admin/content-session`, {
        headers: { Origin: website, Authorization: `Bearer ${credential}` }
      })
    ).status()
  ).toBe(204)
  const csrf = (await context.cookies()).find(
    (c) => c.name === 'comfy_catalog_csrf'
  )?.value
  if (!csrf) throw new Error('Missing verified CSRF')
  const auth = { Authorization: `Bearer ${credential}` }
  const state = await (
    await context.request.get(`${backend}/api/v1/catalog/state`, {
      headers: auth
    })
  ).json()
  const slug = `bruce-preview-fixture-${Date.now()}`
  phase = 'create'
  const created = await context.request.post(
    `${backend}/api/v1/catalog/draft/items`,
    {
      headers: { ...auth, 'Idempotency-Key': `preview-${slug}` },
      data: {
        type: 'workflow',
        schema_version: 1,
        expected_draft_rev: state.draft_rev,
        title: 'BRUCE scheduled Preview fixture',
        slug,
        description:
          'Local-only Preview demonstration. No executable Cloud binding.',
        enabled: true,
        visibility: 'staff',
        available_surfaces: ['hub'],
        visible_from: '2070-01-01T00:00:00Z',
        generation_type: 'generate-images',
        tags: ['local-preview-fixture'],
        inputSchema: {
          type: 'object',
          properties: { prompt: { type: 'string', default: 'Preview prompt' } },
          required: ['prompt'],
          additionalProperties: false
        },
        inputs: {
          prompt: {
            label: 'Prompt',
            help: 'Local simulation only',
            control: 'text-area',
            hidden: false,
            advanced: false
          }
        },
        examples: [
          {
            title: 'Example from CCC',
            description: 'Retained authored values',
            values: { prompt: 'Example prompt' }
          }
        ],
        translations: {
          'zh-CN': {
            title: '预览测试工作流',
            review_state: 'machine'
          }
        }
      }
    }
  )
  expect(created.status()).toBe(201)
  const record = await created.json()
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) =>
    errors.push(
      `${error.name}: ${error.message
        .split('\n')[0]
        .replace(/https?:\/\/[^\s"']+/g, (url) => {
          try {
            return new URL(url).pathname
          } catch {
            return '[URL omitted]'
          }
        })
        .slice(0, 240)}`
    )
  )
  phase = 'editor/upload'
  await page.goto(`${website}/admin/content/${record.uid}/edit`)
  await expect(page.locator('[data-editor-ready=true]')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: true })
  ).toHaveValue('BRUCE scheduled Preview fixture')
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('BRUCE edited Preview fixture')
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(resolve('public/web-app-manifest-512x512.png'))
  phase = 'upload click'
  await page
    .getByRole('button', { name: 'Upload as new media', exact: true })
    .first()
    .click()
  await expect(
    page.locator('code').filter({ hasText: 'web-app-manifest-512x512.png' })
  ).toHaveCount(1)
  phase = 'save click'
  await page
    .getByRole('button', { name: 'Save changes', exact: true })
    .first()
    .click()
  await expect(page.getByRole('status')).toHaveText(
    'Saved in Draft. LIVE is unchanged.'
  )
  phase = 'Draft/NOW'
  await page.goto(`${website}/hub/workflows/?preview=DRAFT`)
  await expect(
    page.getByRole('button', { name: 'EXIT', exact: true })
  ).toBeVisible()
  expect(
    (await context.request.get(`${website}/hub/workflows/${slug}/`)).status()
  ).toBe(404)
  phase = 'calendar command'
  const calendar = page.getByRole('button', {
    name: 'Preview date and time',
    exact: true
  })
  await expect(calendar).toBeEnabled()
  await calendar.click()
  await page
    .getByLabel('Preview date and time (UTC)', { exact: true })
    .fill('2071-01-01T00:00')
  await page
    .getByRole('button', { name: 'Show this date', exact: true })
    .click()
  await expect
    .poll(async () => {
      const selected = (await context.cookies()).find(
        (cookie) => cookie.name === 'comfy_catalog_preview'
      )
      return selected
        ? JSON.parse(decodeURIComponent(selected.value)).now
        : undefined
    })
    .toBe('2071-01-01T00:00:00.000Z')
  phase = 'calendar persists on navigation'
  await page.goto(`${website}/hub/workflows/${slug}/`)
  await expect(
    page.getByRole('heading', {
      name: 'BRUCE edited Preview fixture',
      exact: true
    })
  ).toBeVisible()
  phase = 'timewarp/detail'
  await page.goto(
    `${website}/hub/workflows/${slug}/?preview_at=2071-01-01T00%3A00%3A00Z`
  )
  phase = 'timewarp/heading'
  await expect(
    page.getByRole('heading', {
      name: 'BRUCE edited Preview fixture',
      exact: true
    })
  ).toBeVisible()
  phase = 'timewarp/edit button'
  await expect(
    page.getByRole('link', { name: 'Edit', exact: true })
  ).toBeVisible()
  const flat = await (
    await context.request.get(
      `${backend}/api/v1/catalog/draft/items/${record.uid}`,
      { headers: auth }
    )
  ).json()
  phase = 'private image bytes'
  const privatePath = `/preview-media/${state.draft_rev}/${flat.hero.id}/${flat.hero.file_version_uid}`
  expect((await context.request.get(website + privatePath)).status()).toBe(200)
  const anonymous = await browser.newContext()
  expect((await anonymous.request.get(website + privatePath)).status()).toBe(
    404
  )
  expect(
    (
      await anonymous.request.get(
        `${website}/catalog-media/${flat.hero.id}/${flat.hero.file_version_uid}`
      )
    ).status()
  ).toBe(404)
  await anonymous.close()
  expect(
    (
      await context.request.get(website + privatePath, {
        headers: { Range: 'bytes=0-10' }
      })
    ).status()
  ).toBe(404)
  phase = 'locale'
  await page
    .getByRole('combobox', { name: 'Preview language', exact: true })
    .selectOption('zh-CN')
  await expect(
    page.getByRole('heading', { name: '预览测试工作流', exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('未翻译的字段使用源语言（en）：$.description', {
      exact: true
    })
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/ccc-bruce-preview-detail.png',
    fullPage: true
  })
  phase = 'NOW/EXIT'
  await expect(
    page.getByRole('button', { name: '现在', exact: true })
  ).toBeEnabled()
  await page.getByRole('button', { name: '现在', exact: true }).click()
  await expect
    .poll(async () =>
      (await context.request.get(`${website}/hub/workflows/${slug}/`)).status()
    )
    .toBe(404)
  await page.goto(`${website}/zh-CN/hub/workflows/`)
  phase = 'EXIT'
  await expect(
    page.getByRole('button', { name: '退出', exact: true })
  ).toBeEnabled()
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '退出', exact: true })
  ).toHaveCount(0)
  expect(
    (await context.request.get(`${website}/hub/workflows/${slug}/`)).status()
  ).toBe(404)
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`)
  process.stdout.write(
    `${JSON.stringify({
      passed: true,
      fixture_uid: record.uid,
      slug,
      fixture: 'staff-only, scheduled, Draft-only; retained',
      browser_errors: 0
    })}\n`
  )
} catch (error) {
  const reason =
    error instanceof Error
      ? error.message.split('\n')[0].slice(0, 160)
      : 'unknown'
  // Report only the redacted reason: the original error can carry private
  // request details, so it is deliberately not attached as a cause.
  process.stderr.write(
    `Local Preview check failed at ${phase}: ${reason.replace(/Bearer\s+\S+/g, '[credential omitted]')}; private request details suppressed\n`
  )
  process.exitCode = 1
} finally {
  await browser.close()
}
