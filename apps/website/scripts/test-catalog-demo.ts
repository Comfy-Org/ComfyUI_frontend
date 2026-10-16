import { readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const file = process.env.CCC_DEMO_TEST_PRIVATE_FILE
if (!file) throw new Error('Private invitation fixture file required')
const data = JSON.parse(await readFile(file, 'utf8')) as {
  code: string
  cookies: [string, string][]
}
const remote = 'https://fringe-partly-gap.ngrok-free.dev'
const local = 'http://127.0.0.1:4349'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' },
    serviceWorkers: 'block'
  })
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === remote)
      return route.continue()
    if (route.request().resourceType() === 'image')
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
      })
    return route.abort()
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.name))
  expect((await page.goto(remote + '/admin/catalog'))?.status()).toBe(404)
  expect((await page.goto(remote + '/admin/catalog-sign-in'))?.status()).toBe(
    200
  )
  await page.getByLabel('Invitation code').fill(data.code)
  await Promise.all([
    page.waitForURL(remote + '/admin/catalog'),
    page.getByRole('button', { name: 'Open administration' }).click()
  ])
  expect((await page.goto(remote + '/admin/content/new'))?.status()).toBe(200)
  expect(
    (await page.goto(remote + '/hub/workflows/?preview=DRAFT'))?.status()
  ).toBe(200)
  await expect(
    page.getByRole('button', { name: 'EXIT', exact: true })
  ).toBeVisible()
  const demoCookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'comfy_catalog_demo'
  )
  expect(demoCookie?.httpOnly).toBe(true)
  expect(demoCookie?.secure).toBe(true)
  expect(demoCookie?.sameSite).toBe('Strict')
  expect(
    (await context.request.get(remote + '/admin/local-access')).status()
  ).toBe(404)
  expect(
    (await context.request.get(remote + '/admin/catalog-testers')).status()
  ).toBe(404)
  expect(
    (
      await context.request.post(remote + '/admin/catalog-preview', {
        headers: {
          Origin: 'https://outside.invalid',
          'X-Comfy-CSRF': (
            await context.cookies()
          ).find((cookie) => cookie.name === 'comfy_catalog_csrf')!.value
        },
        data: { view: 'LIVE', now: 'now' }
      })
    ).status()
  ).toBe(403)
  // A redeemed code cannot establish another session.
  const outsider = await browser.newContext({
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' }
  })
  const login = await outsider.request.get(remote + '/admin/catalog-sign-in')
  const loginCsrf = (await login.text()).match(
    /name="csrf"\s+value="([^"]+)"/
  )?.[1]
  expect(
    (
      await outsider.request.post(remote + '/admin/catalog-demo-session', {
        headers: { Origin: remote },
        form: { csrf: loginCsrf!, code: data.code }
      })
    ).status()
  ).toBe(403)
  // Revoke ONLY this named verification invitation from the local manager.
  const headers = {
    Cookie: data.cookies.map(([key, value]) => `${key}=${value}`).join('; ')
  }
  const manager = await fetch(local + '/admin/catalog-testers', { headers })
  const html = await manager.text()
  const row = html.match(
    /BRUCE remote verification[\s\S]*?name="id"\s+value="([^"]+)"/
  )
  const csrf = html.match(/name="csrf"\s+value="([^"]+)"/)?.[1]
  if (!row || !csrf) throw new Error('Verification invitation not found')
  const revoked = await fetch(local + '/admin/catalog-testers', {
    method: 'POST',
    headers: {
      ...headers,
      Origin: local,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ action: 'revoke', id: row[1], csrf })
  })
  expect(revoked.status).toBe(200)
  expect((await context.request.get(remote + '/admin/catalog')).status()).toBe(
    403
  )
  expect(
    (
      await context.request.get(remote + '/hub/workflows/?preview=DRAFT')
    ).status()
  ).toBe(403)
  expect(
    (await context.request.get(remote + '/api/v1/catalog/docs')).status()
  ).toBe(200)
  expect(errors).toEqual([])
  process.stdout.write(
    'PASS: actual ngrok invitation sign-in/Admin/editor/Draft, Secure HttpOnly Strict cookies, one-time redemption, cross-origin rejection, revocation and public docs; no catalog edits/publication.\n'
  )
} finally {
  await browser.close()
}
