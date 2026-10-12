// Local demo recovery check: creates/revokes only its own temporary invitation.
// It never approves, discards, publishes or edits catalog content.
import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { chromium, expect, request } from '@playwright/test'
import { z } from 'zod'

const local = new URL(process.env.CCC_LOCAL_SITE ?? 'http://127.0.0.1:4349')
const remote = new URL(process.env.CCC_REMOTE_SITE ?? local.origin)
const credentialFile = process.env.CCC_REVIEW_CREDENTIAL_FILE
const screenshots = process.env.CCC_REVIEW_SCREENSHOT_DIR
if (
  local.hostname !== '127.0.0.1' ||
  local.protocol !== 'http:' ||
  !credentialFile ||
  !isAbsolute(credentialFile) ||
  (remote.origin !== local.origin &&
    (remote.protocol !== 'https:' ||
      !remote.hostname.endsWith('.ngrok-free.dev'))) ||
  (screenshots && !isAbsolute(screenshots))
)
  throw new Error('Explicit local demo configuration required')
const credential = (await readFile(credentialFile, 'utf8')).trim()
const manager = await request.newContext({ baseURL: local.origin })
const guest = await request.newContext({
  baseURL: remote.origin,
  extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' }
})
const snapshotSchema = z.object({
  state: z
    .object({
      live_rev: z.number(),
      draft_rev: z.number(),
      draft_generation: z.number()
    })
    .passthrough(),
  items: z.array(z.unknown()),
  unresolved_count: z.number().int().nonnegative(),
  selection_digest: z.string()
})
const name = `Local review UI probe ${Date.now()}`
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let invitationID: string | undefined
let csrf: string | undefined
function field(html: string, name: string) {
  const tag = html.match(
    new RegExp('<input[^>]*name="' + name + '"[^>]*>')
  )?.[0]
  return tag?.match(/value="([^"]*)"/)?.[1]
}
try {
  expect(
    (
      await manager.post('/admin/content-session', {
        headers: { Origin: local.origin, Authorization: `Bearer ${credential}` }
      })
    ).status()
  ).toBe(204)
  const managerPage = await manager.get('/admin/catalog-testers')
  expect(managerPage.status()).toBe(200)
  csrf = field(await managerPage.text(), 'csrf')
  if (!csrf) throw new Error('Manager CSRF missing')
  const created = await manager.post('/admin/catalog-testers', {
    headers: { Origin: local.origin },
    form: { csrf, name, role: 'publish' }
  })
  expect(created.status()).toBe(200)
  const html = await created.text()
  const code = html
    .match(/<input[^>]*aria-label="New invitation code"[^>]*>/)?.[0]
    .match(/value="([a-f0-9]{64})"/)?.[1]
  invitationID = field(
    html.slice(html.indexOf(name)).split('</li>')[0] ?? '',
    'id'
  )
  if (!code || !invitationID) throw new Error('Probe invitation missing')
  const signIn = await guest.get('/admin/catalog-sign-in')
  const loginCSRF = field(await signIn.text(), 'csrf')
  if (!loginCSRF) throw new Error('Sign-in CSRF missing')
  expect(
    (
      await guest.post('/admin/catalog-demo-session', {
        headers: { Origin: remote.origin },
        form: { csrf: loginCSRF, code },
        maxRedirects: 0
      })
    ).status()
  ).toBe(303)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    storageState: await guest.storageState(),
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' }
  })
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === remote.origin
      ? route.continue()
      : route.abort()
  )
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  expect(
    (
      await page.goto(remote.origin + '/admin/catalog', {
        waitUntil: 'networkidle',
        timeout: 45000
      })
    )?.status()
  ).toBe(200)
  for (const label of ['Approve Selected', 'Defer Selected', 'Delete Changes'])
    await expect(
      page.getByRole('button', { name: label, exact: true })
    ).toBeVisible()
  const add = page.getByRole('link', { name: 'Add Content', exact: true })
  await expect(add).toBeVisible()
  expect(
    await add.evaluate((element) =>
      ['Approve Selected', 'Defer Selected', 'Delete Changes'].every((text) =>
        Array.from(
          element.parentElement?.querySelectorAll('button') ?? []
        ).some((button) => button.textContent?.trim() === text)
      )
    )
  ).toBe(true)
  const review = await guest.get('/admin/catalog-api/staging')
  expect(review.status()).toBe(200)
  const snapshot = snapshotSchema.parse(await review.json())
  const unresolved = `You still have ${snapshot.unresolved_count} entries not approved or deferred.`
  if (snapshot.unresolved_count > 0) {
    await expect(page.getByRole('button', { name: 'Next →', exact: true })).toBeDisabled()
    await expect(page.getByText(unresolved, { exact: true })).toBeVisible()
  } else {
    await expect(page.getByRole('link', { name: 'Next →', exact: true })).toBeVisible()
  }
  if (snapshot.items.length) {
  const trash = page.getByRole('button', { name: /^Delete change for / })
  expect(await trash.count()).toBe(snapshot.items.length)
  await trash.first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: /^Decision for / })
    .first()
    .click()
  for (const label of ['APPROVED', 'DEFERRED'])
    await expect(
      page.getByRole('menuitem', { name: label, exact: true })
    ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: 'NEW', exact: true })
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  const all = page.getByRole('checkbox', {
    name: 'Select all matching results',
    exact: true
  })
  await all.check()
  await expect(
    page.getByRole('button', { name: 'Delete Changes', exact: true })
  ).toBeDisabled()
  await page
    .getByRole('checkbox', { name: /I understand this unfiltered action/ })
    .check()
  await expect(
    page.getByRole('button', { name: 'Delete Changes', exact: true })
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'Delete Changes', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await all.uncheck()
  }
  if (screenshots)
    await page.screenshot({
      path: join(screenshots, 'admin-restored-desktop.png'),
      fullPage: true
    })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(add).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  if (screenshots)
    await page.screenshot({
      path: join(screenshots, 'admin-restored-mobile.png'),
      fullPage: true
    })
  const final = await guest.get('/admin/catalog/final-review')
  expect(final.status()).toBe(200)
  if (snapshot.unresolved_count > 0) expect(await final.text()).toContain(unresolved)
  else {
    const authority = await guest.get('/admin/catalog-api/final-review')
    await page.goto(remote.origin + '/admin/catalog/final-review', { waitUntil: 'networkidle' })
    const button = page.getByRole('button', { name: 'Publish', exact: true })
    if (authority.status() === 200) {
      const ready = z.object({ publish_enabled: z.boolean() }).parse(await authority.json())
      if (ready.publish_enabled) await expect(button).toBeEnabled()
      else await expect(button).toBeDisabled()
    } else {
      expect(authority.status()).toBe(422)
      await expect(button).toBeDisabled()
    }
    if (screenshots) await page.screenshot({ path: join(screenshots, 'local-publish-final-review.png'), fullPage: true })
  }
  for (const path of [
    '/hub/models/?preview=DRAFT',
    '/api/v1/catalog/docs',
    '/api/v1/catalog/openapi.json',
    '/api/v1/catalog/agents'
  ])
    expect((await guest.get(path)).status()).toBe(200)
  expect(errors).toEqual([])
  const after = snapshotSchema.parse(
    await (await guest.get('/admin/catalog-api/staging')).json()
  )
  expect(after.state).toEqual(snapshot.state)
  expect(after.selection_digest).toBe(snapshot.selection_digest)
  console.log(
    JSON.stringify({
      result: 'PASS',
      pending: snapshot.items.length,
      unresolved: snapshot.unresolved_count,
      desktop: true,
      mobile: true,
      pageErrors: 0,
      contentMutations: 0
    })
  )
} finally {
  await browser?.close()
  if (invitationID && csrf)
    expect(
      (
        await manager.post('/admin/catalog-testers', {
          headers: { Origin: local.origin },
          form: { csrf, action: 'revoke', id: invitationID }
        })
      ).status()
    ).toBe(200)
  await manager.dispose()
  await guest.dispose()
}
