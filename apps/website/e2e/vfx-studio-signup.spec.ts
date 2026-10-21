import { join } from 'node:path'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { websiteRoot } from '@website/paths'
import { test } from './fixtures/blockExternalMedia'
import { expectIslandHydrated } from './fixtures/islands'
import { vfxMediaRoot } from '@/data/vfxMedia'

const SIGNUP = 'https://cloud.comfy.org/cloud/signup'
const QUERY =
  'utm_source=linkedin&utm_medium=paid_social&utm_campaign=vfx&utm_content=v3'
const DESTINATION = `${SIGNUP}?${QUERY}`

async function clickSignup(_page: Page, studio: Locator, label: string) {
  await studio.getByRole('link', { name: label }).click()
}
async function keyboardSignup(page: Page, studio: Locator, label: string) {
  await studio.getByRole('link', { name: label }).focus()
  await page.keyboard.press('Enter')
}
async function dropFootage(page: Page, studio: Locator) {
  await studio.getByRole('tab', { name: 'SETTINGS' }).click()
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(
      new File(['private-footage-bytes'], 'private-footage.mov', {
        type: 'video/quicktime'
      })
    )
    return data
  })
  await studio
    .getByRole('textbox', { name: 'Describe the shot' })
    .dispatchEvent('dragover', { dataTransfer: transfer })
  await studio
    .getByRole('textbox', { name: 'Describe the shot' })
    .dispatchEvent('drop', { dataTransfer: transfer })
}

for (const { name, path, open, label, activate } of [
  {
    name: 'pointer',
    path: '/solutions/vfx/v3/',
    open: 'OPEN STUDIO',
    label: 'SIGN UP TO TRY FREE',
    activate: clickSignup
  },
  {
    name: 'keyboard',
    path: '/solutions/vfx/v3/',
    open: 'OPEN STUDIO',
    label: 'SIGN UP TO TRY FREE',
    activate: keyboardSignup
  },
  {
    name: 'file drop',
    path: '/solutions/vfx/v3/',
    open: 'OPEN STUDIO',
    label: 'SIGN UP TO TRY FREE',
    activate: dropFootage
  },
  {
    name: 'Chinese pointer',
    path: '/zh-CN/solutions/vfx/v3/',
    open: '打开工作室',
    label: '注册免费试用',
    activate: clickSignup
  }
]) {
  test(`${name} footage intent enters signup without a picker or file transfer`, async ({
    page,
    context
  }) => {
    await context.route(`${vfxMediaRoot}/*.mp4`, (route) =>
      route.fulfill({
        path: join(websiteRoot, 'e2e/assets/vfx-playback.mp4'),
        contentType: 'video/mp4'
      })
    )
    await context.route(`${SIGNUP}**`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<h1>Existing signup destination</h1>'
      })
    )
    await page.goto(
      `${path}?${QUERY}&filename=page-query.mov&email=private@example.com`
    )
    const section = page.locator('[data-vfx-demo="relight"]')
    await section
      .locator('.vfx-canvas-window')
      .evaluate((node) =>
        node.scrollIntoView({ block: 'start', behavior: 'instant' })
      )
    await expect(section).toHaveAttribute('data-canvas-ready', '', {
      timeout: 12000
    })
    await section.getByRole('button', { name: open, exact: true }).click()
    const studio = section.locator('[data-vfx-studio]')
    await expectIslandHydrated(
      page,
      page.getByRole('link', { name: label, exact: true })
    )
    const link = studio.getByRole('link', { name: label })
    await expect(link).toHaveAttribute('href', DESTINATION)
    await expect(studio.locator('input[type=file]')).toHaveCount(0)
    let pickerOpened = false
    page.on('filechooser', () => {
      pickerOpened = true
    })
    const sent: string[] = []
    page.on('request', (request) =>
      sent.push(
        JSON.stringify({
          url: request.url(),
          method: request.method(),
          body: request.postData()
        })
      )
    )
    await activate(page, studio, label)
    await expect(page).toHaveURL(DESTINATION)
    expect(pickerOpened).toBe(false)
    expect(sent.join('\n')).not.toContain('private-footage')
    expect(sent.join('\n')).not.toContain('page-query.mov')
    expect(sent.join('\n')).not.toContain('private@example.com')
    await expect(
      page.getByRole('heading', { name: 'Existing signup destination' })
    ).toBeVisible()
  })
}
