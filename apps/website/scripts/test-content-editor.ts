import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

// Explicitly opt into labeled, disabled local fixtures. Never accepts a token
// on the command line or logs request headers/cookies. No production target.
const credentialFile = process.env.CCC_EDITOR_TEST_CREDENTIAL_FILE
const port = process.env.CCC_EDITOR_TEST_WEBSITE_PORT ?? '4367'
if (!['4349', '4367'].includes(port))
  throw new Error('Only isolated local website ports 4349 or 4367 are allowed')
const website = `http://127.0.0.1:${port}`
const screenshot = `/tmp/ccc-${port === '4349' ? 'bruce' : 'buck'}-content-editor.png`
const backend = 'http://127.0.0.1:8109'
if (!credentialFile)
  throw new Error(
    'Set CCC_EDITOR_TEST_CREDENTIAL_FILE to a private local fixture JWT file'
  )
const credential = (await readFile(credentialFile, 'utf8')).trim()
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  })
  const anonymous = await context.request.get(`${website}/admin/content/new`)
  expect(anonymous.status()).toBe(404)
  const forged = await context.request.post(
    `${website}/admin/content-session`,
    {
      headers: { Origin: website, Authorization: 'Bearer forged-local-token' }
    }
  )
  expect(forged.status()).toBe(403)
  const established = await context.request.post(
    `${website}/admin/content-session`,
    {
      headers: { Origin: website, Authorization: `Bearer ${credential}` }
    }
  )
  expect(established.status()).toBe(204)
  const cookies = await context.cookies()
  const secretCookie = cookies.find(
    (cookie) => cookie.name === 'comfy_catalog_authoring'
  )
  expect(secretCookie?.httpOnly).toBe(true)
  expect(secretCookie?.sameSite).toBe('Strict')
  const csrf = cookies.find(
    (cookie) => cookie.name === 'comfy_catalog_csrf'
  )?.value
  if (!csrf) throw new Error('Verified session did not establish a CSRF cookie')
  const rejected = await context.request.post(
    `${website}/admin/content-api/save`,
    {
      headers: {
        Origin: 'http://attacker.invalid',
        'X-Comfy-CSRF': csrf,
        'Idempotency-Key': 'browser-csrf-refusal'
      },
      data: {}
    }
  )
  expect(rejected.status()).toBe(403)
  const page = await context.newPage()
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.name))
  const slug = `buck-editor-fixture-${Date.now()}`
  await page.goto(`${website}/admin/content/new?type=workflow`)
  await expect(page.locator('[data-editor-ready=true]')).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('BUCK local browser fixture')
  await page.getByRole('textbox', { name: 'URL slug', exact: true }).fill(slug)
  await page.getByRole('textbox', { name: 'Parameter name' }).fill('prompt')
  await page.getByRole('button', { name: 'Add input', exact: true }).click()
  await page.getByRole('textbox', { name: 'Label', exact: true }).fill('Prompt')
  await page.getByRole('button', { name: 'Add example', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Example title' })
    .fill('Local example')
  const exampleValues = page.getByRole('textbox', {
    name: 'Input values (JSON)'
  })
  await exampleValues.fill('{invalid-example')
  await page.getByText('Advanced: complete authored JSON').click()
  const completeDocument = page.getByRole('textbox', {
    name: 'Complete content document'
  })
  await expect(completeDocument).toBeDisabled()
  await expect(exampleValues).toHaveValue('{invalid-example')
  await exampleValues.fill('{}')
  await expect(completeDocument).toBeEnabled()
  const completeBeforeRepair = await completeDocument.inputValue()
  await completeDocument.fill('{invalid-complete')
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Add example', exact: true })
  ).toBeDisabled()
  await expect(completeDocument).toBeEnabled()
  await completeDocument.fill(completeBeforeRepair)
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: true })
  ).toBeEnabled()
  await expect(exampleValues).toHaveValue('{}')
  const authoredWithLabels = JSON.parse(await completeDocument.inputValue())
  const literalLabels = JSON.parse(
    '{"__proto__":"Literal label","constructor":"Constructor label"}'
  )
  authoredWithLabels.inputs.prompt.optionLabels = literalLabels
  authoredWithLabels.inputs.guidance = {
    label: 'Guidance',
    help: 'Retain numeric help',
    control: 'slider',
    hidden: false,
    advanced: true
  }
  authoredWithLabels.inputSchema.properties.guidance = {
    type: 'number',
    minimum: 0,
    maximum: 10,
    default: 0,
    multipleOf: 0.5,
    description: 'Keep numeric description'
  }
  authoredWithLabels.inputs.quality = {
    label: 'Quality',
    help: '',
    control: 'dropdown',
    hidden: false,
    advanced: false,
    optionLabels: { false: 'Off', '0': 'Zero', high: 'High' }
  }
  authoredWithLabels.inputSchema.properties.quality = {
    enum: [false, 0, 'high'],
    default: false,
    description: 'Keep typed options'
  }
  await completeDocument.fill(JSON.stringify(authoredWithLabels, null, 2))
  // A structured input edit must not erase inert literal JSON keys.
  await page
    .getByRole('textbox', { name: 'Label', exact: true })
    .first()
    .fill('Prompt preserved')
  const maximum = page.getByRole('textbox', { name: 'Maximum', exact: true })
  await maximum.fill('1e')
  await expect(maximum).toHaveValue('1e')
  await expect(
    page.getByRole('button', { name: 'Save changes', exact: true }).first()
  ).toBeDisabled()
  await expect(completeDocument).toBeDisabled()
  await maximum.fill('20')
  await expect(completeDocument).toBeEnabled()
  await page
    .getByRole('button', { name: 'Move option down', exact: true })
    .first()
    .click()
  await page
    .getByRole('textbox', { name: 'Display label (optional)', exact: true })
    .first()
    .fill('Exactly zero')
  await page
    .getByRole('button', { name: 'Save changes', exact: true })
    .first()
    .click()
  await expect(page.getByRole('status')).toHaveText(
    'Saved in Draft. LIVE is unchanged.'
  )
  const match = /\/admin\/content\/([0-9a-f-]{36})\/edit/.exec(page.url())
  if (!match)
    throw new Error('New resource did not acquire a stable UID editor URL')
  const uid = match[1]
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(resolve('public/web-app-manifest-512x512.png'))
  await page
    .getByRole('button', { name: 'Upload as new media', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Uploading…', exact: true })
  ).toHaveCount(0)
  await expect(
    page.locator('code').filter({ hasText: 'web-app-manifest-512x512.png' })
  ).toHaveCount(1)
  await page
    .getByRole('button', { name: 'Save changes', exact: true })
    .first()
    .click()
  await expect(page.getByRole('status')).toHaveText(
    'Saved in Draft. LIVE is unchanged.'
  )
  const auth = { Authorization: `Bearer ${credential}` }
  const read = await context.request.get(
    `${backend}/api/v1/catalog/draft/items/${uid}`,
    { headers: auth }
  )
  expect(read.status()).toBe(200)
  const document = await read.json()
  const identityResponse = await context.request.get(
    `${backend}/api/v1/catalog/authoring-context`,
    { headers: auth }
  )
  expect(identityResponse.status()).toBe(200)
  const identity = await identityResponse.json()
  expect(document.owner_uid).toBe(identity.owner_uid)
  expect(document.author_uid).toBe(identity.actor_uid)
  expect(document.saved_by_uid).toBe(identity.actor_uid)
  expect(document).toMatchObject({
    title: 'BUCK local browser fixture',
    slug,
    enabled: false,
    visibility: 'staff',
    inputs: {
      prompt: {
        label: 'Prompt preserved',
        control: 'text-box',
        optionLabels: literalLabels
      }
    },
    examples: [{ title: 'Local example', values: {} }],
    hero: {
      src: 'r2',
      id: expect.any(String),
      file_version_uid: expect.any(String)
    }
  })
  expect(Object.hasOwn(document.inputs.prompt.optionLabels, '__proto__')).toBe(
    true
  )
  expect(document.inputSchema.properties.guidance).toEqual({
    type: 'number',
    minimum: 0,
    maximum: 20,
    default: 0,
    multipleOf: 0.5,
    description: 'Keep numeric description'
  })
  expect(document.inputSchema.properties.quality).toEqual({
    enum: [0, false, 'high'],
    default: false,
    description: 'Keep typed options'
  })
  expect(document.inputs.quality.optionLabels).toEqual({
    '0': 'Exactly zero',
    false: 'Off',
    high: 'High'
  })
  expect(Object.hasOwn(Object.prototype, 'Literal label')).toBe(false)
  // Reload reads the exact current Draft JSON without generating another edit.
  const before = document.revision_uid
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: true })
  ).toHaveValue('BUCK local browser fixture')
  const reread = await context.request.get(
    `${backend}/api/v1/catalog/draft/items/${uid}`,
    { headers: auth }
  )
  expect((await reread.json()).revision_uid).toBe(before)
  await expect(
    page.getByRole('textbox', { name: 'Maximum', exact: true })
  ).toHaveValue('20')
  await expect(
    page.getByRole('textbox', { name: 'Option value', exact: true }).first()
  ).toHaveValue('0')
  await page.screenshot({
    path: screenshot,
    fullPage: true
  })
  const state = await context.request.get(`${backend}/api/v1/catalog/state`, {
    headers: auth
  })
  const catalog = await state.json()
  const live = await context.request.get(
    `${backend}/api/v1/catalog/revisions/${catalog.live_rev}/items/${uid}`,
    { headers: auth }
  )
  expect(live.status()).toBe(404)
  expect(browserErrors).toEqual([])
  const exit = await context.request.delete(
    `${website}/admin/content-session`,
    { headers: { Origin: website, 'X-Comfy-CSRF': csrf } }
  )
  expect(exit.status()).toBe(204)
  expect(
    (await context.request.get(`${website}/admin/content/${uid}/edit`)).status()
  ).toBe(404)
  console.log(
    JSON.stringify({
      passed: true,
      fixture_uid: uid,
      fixture_state: 'disabled/staff-only Draft; intentionally retained',
      screenshot,
      browser_errors: 0,
      json_buffer_repair: true,
      literal_json_keys: true,
      structured_input_settings: true
    })
  )
} catch {
  throw new Error(
    'Local browser check failed; private request details suppressed'
  )
} finally {
  await browser.close()
}
