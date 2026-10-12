import { readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const privateFile = process.env.CCC_IMPORT_TEST_CREDENTIAL_FILE
if (!privateFile)
  throw new Error('Explicit private fixture credential required')
const credential = (await readFile(privateFile, 'utf8')).trim()
const local = 'http://127.0.0.1:4349'
const remote = 'https://fringe-partly-gap.ngrok-free.dev'
const browser = await chromium.launch({ headless: true })
let phase = 'local invitation'
try {
  const manager = await browser.newContext()
  expect(
    (
      await manager.request.post(local + '/admin/content-session', {
        headers: { Origin: local, Authorization: `Bearer ${credential}` }
      })
    ).status()
  ).toBe(204)
  const page = await manager.newPage()
  expect((await page.goto(local + '/admin/catalog-testers'))?.status()).toBe(
    200
  )
  await page.getByLabel('Tester name').fill('BRUCE imported-site verification')
  await page.getByLabel('Demo access').selectOption('publish')
  await page.getByRole('button', { name: 'Create invitation' }).click()
  const code = await page.getByLabel('New invitation code').inputValue()
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
  const tester = await context.newPage()
  const errors: string[] = []
  tester.on('pageerror', (error) => errors.push(error.name))
  phase = 'remote sign-in'
  expect((await tester.goto(remote + '/admin/catalog-sign-in'))?.status()).toBe(
    200
  )
  await tester.getByLabel('Invitation code').fill(code)
  await Promise.all([
    tester.waitForURL(remote + '/admin/catalog'),
    tester.getByRole('button', { name: 'Open administration' }).click()
  ])
  phase = 'original baseline LIVE'
  const liveAuthority = await fetch(
    'http://127.0.0.1:8109/admin/api/site/catalog?view=LIVE&eligible=true',
    { headers: { Authorization: `Bearer ${credential}` } }
  )
  expect(liveAuthority.status).toBe(200)
  const live = await liveAuthority.json()
  expect(live.items).toHaveLength(180)
  expect(
    (await tester.goto(remote + '/hub/models/?preview=LIVE&now=now'))?.status()
  ).toBe(200)
  await expect(
    tester.getByRole('button', { name: 'EXIT', exact: true })
  ).toHaveCount(0)
  await expect
    .poll(() => tester.locator('a[href^="/hub/models/"]').count())
    .toBeGreaterThan(5)
  const publicLive = await anonymousLiveCheck()
  expect(publicLive).toBe(200)
  phase = 'Draft models'
  expect(
    (await tester.goto(remote + '/hub/models/?preview=DRAFT'))?.status()
  ).toBe(200)
  await expect(
    tester.getByRole('button', { name: 'EXIT', exact: true })
  ).toBeVisible()
  phase = 'Draft workflows'
  expect((await tester.goto(remote + '/hub/workflows/'))?.status()).toBe(200)
  await expect(tester.getByRole('heading', { level: 1 })).toHaveText(
    /workflows/i
  )
  phase = 'Draft apps'
  expect((await tester.goto(remote + '/hub/apps/'))?.status()).toBe(200)
  phase = 'snapshot counts and bytes'
  const projection = await fetch(
    'http://127.0.0.1:8109/admin/api/site/catalog?view=DRAFT&eligible=true',
    { headers: { Authorization: `Bearer ${credential}` } }
  )
  expect(projection.status).toBe(200)
  const body = await projection.json()
  expect(body.items).toHaveLength(180)
  const workflow = body.items.find(
    (item: { kind: string }) => item.kind === 'WORKFLOW'
  )
  phase = 'workflow detail'
  expect((await tester.goto(remote + workflow.slug + '/'))?.status()).toBe(200)
  const edit = tester.getByRole('link', { name: 'Edit', exact: true })
  phase = 'workflow Edit link'
  await expect(edit).toBeVisible()
  await edit.click()
  phase = 'workflow form title'
  await expect(tester.getByLabel('Title', { exact: true })).toHaveValue(
    workflow.data.title
  )
  const fileRef = workflow.data.workflow_files[0].file
  phase = 'exact workflow media authority'
  const authority = await fetch(
    'http://127.0.0.1:8109/api/v1/catalog/draft/items/' + fileRef.id,
    { headers: { Authorization: `Bearer ${credential}` } }
  )
  expect(authority.status).toBe(200)
  const media = await authority.json()
  const bytePath = `/preview-media/${body.revision_id}/${media.uid}/${media.revision_uid}`
  phase = 'private workflow bytes'
  const bytes = await context.request.get(remote + bytePath)
  expect(bytes.status()).toBe(200)
  expect(bytes.headers()['content-type']).toContain('application/json')
  expect((await bytes.body()).length).toBe(media.byte_size)
  const anonymous = await browser.newContext({
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' }
  })
  phase = 'anonymous/range byte refusal'
  expect((await anonymous.request.get(remote + bytePath)).status()).toBe(404)
  phase = 'anonymous original baseline file'
  const publicBytes = await anonymous.request.get(
    `${remote}/catalog-media/${media.uid}/${media.revision_uid}`
  )
  expect(publicBytes.status()).toBe(200)
  expect(await publicBytes.body()).toEqual(await bytes.body())
  expect(
    (
      await anonymous.request.get(
        `${remote}/catalog-media/${media.uid}/${media.revision_uid}`,
        {
          headers: { Range: 'bytes=0-9' }
        }
      )
    ).status()
  ).toBe(404)
  expect(
    (
      await context.request.get(remote + bytePath, {
        headers: { Range: 'bytes=0-9' }
      })
    ).status()
  ).toBe(404)
  phase = 'docs and exits'
  expect(
    (
      await context.request.get(remote + '/api/v1/catalog/openapi.json')
    ).status()
  ).toBe(200)
  expect(
    (await context.request.get(remote + '/api/v1/catalog/agents')).status()
  ).toBe(200)
  expect(
    (await context.request.get(remote + '/admin/local-access')).status()
  ).toBe(404)
  expect(errors).toEqual([])
  await page.goto(local + '/admin/catalog-testers')
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'BRUCE imported-site verification' })
    .last()
  await row.getByRole('button', { name: 'Revoke' }).click()
  console.log(
    'PASS: original LIVE baseline180 -> no Preview banner/anonymous200 -> ngrok invitation -> imported Draft models/workflows/apps -> workflow EDIT/read-only form -> local-bucket workflow bytes; anonymous/range refusal and discovery. No content saves or publication.'
  )
} catch (error) {
  console.error('Import browser check failed at:', phase)
  console.error(
    error instanceof Error
      ? error.message
          .split('\n')
          .filter(Boolean)
          .slice(0, 6)
          .join('\n')
          .slice(0, 500)
      : 'Verification failure'
  )
  throw new Error(
    error instanceof Error ? error.name : 'Browser verification failed'
  )
} finally {
  await browser.close()
}

async function anonymousLiveCheck() {
  const anonymous = await browser.newContext({
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' }
  })
  try {
    const response = await anonymous.request.get(remote + '/hub/models/')
    expect(await response.text()).toContain('/hub/models/')
    return response.status()
  } finally {
    await anonymous.close()
  }
}
