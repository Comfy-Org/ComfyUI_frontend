import { chromium, expect } from '@playwright/test'

const website = 'http://127.0.0.1:4353'
const browser = await chromium.launch({ headless: true })
try {
  for (const fixture of [
    {
      locale: 'en',
      width: 1440,
      title: 'Title',
      bar: 'Unsaved changes',
      discard: 'Discard unsaved edits',
      suffix: 'desktop'
    },
    {
      locale: 'zh-CN',
      width: 390,
      title: '标题',
      bar: '有未保存的更改',
      discard: '放弃未保存的编辑',
      suffix: 'mobile-zh'
    }
  ]) {
    const context = await browser.newContext({
      viewport: { width: fixture.width, height: 900 }
    })
    const writes: string[] = []
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() !== 'GET') {
        writes.push(request.method())
        await route.abort()
      } else if (
        url.origin === website &&
        url.pathname === '/admin/content-api/profiles'
      ) {
        await route.fulfill({ json: { items: [] } })
      } else if (
        url.origin === website &&
        !/^\/(?:admin|api)\//.test(url.pathname)
      ) {
        await route.continue()
      } else await route.abort()
    })
    const page = await context.newPage()
    await page.routeWebSocket('**', (socket) => socket.close())
    await page.addInitScript('globalThis.__name = (value) => value')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${website}/hub/models/`)
    await page.evaluate(async (locale) => {
      const path = '/src/components/cms/editor/ContentEditor.vue'
      const stylePath = '/src/styles/global.css'
      await import(stylePath)
      const source = await (await fetch(path)).text()
      const runtime = source.match(
        /from\s+["']([^"']*\/vue\.js[^"']*)["']/
      )?.[1]
      if (!runtime) throw new Error('Component Vue runtime not found')
      const { createApp, h } = await import(runtime)
      const editor = (await import(path)).default
      const document = {
        title: 'Save bar fixture',
        slug: 'save-bar-fixture',
        long_description: 'Preserve this paragraph.',
        faq: [{ question: 'Keep?', answer: 'Yes.' }],
        custom: { nested: ['keep'] }
      }
      const snapshot = {
        uid: '00000000-0000-4000-8000-000000000001',
        type: 'workflow',
        revision_uid: '00000000-0000-4000-8000-000000000002',
        schema_version: 2,
        expected_draft_rev: 7,
        expected_revision_uid: '00000000-0000-4000-8000-000000000002',
        document
      }
      window.document.body.replaceChildren()
      window.document.body.className = 'bg-admin-page text-admin-fg'
      const root = window.document.createElement('main')
      root.className = 'mx-auto max-w-7xl px-5 py-8 sm:px-8'
      window.document.body.append(root)
      createApp({
        render: () =>
          h(editor, {
            initial: document,
            snapshot,
            type: 'workflow',
            draft: 7,
            csrf: 'fixture-no-backend-access',
            locale
          })
      }).mount(root)
    }, fixture.locale)
    const title = page.getByRole('textbox', {
      name: fixture.title,
      exact: true
    })
    await expect(page.getByRole('region', { name: fixture.bar })).toHaveCount(0)
    await title.fill('Pending form edit')
    const bar = page.getByRole('region', { name: fixture.bar })
    await expect(bar).toBeVisible()
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    const bounds = await bar.boundingBox()
    expect(bounds).not.toBeNull()
    expect(
      Math.abs((bounds?.y ?? 0) + (bounds?.height ?? 0) - 900)
    ).toBeLessThanOrEqual(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/ccc-bruce-editor-save-bar-${fixture.suffix}.png`
    })
    await bar.getByRole('button', { name: fixture.discard }).click()
    await expect(title).toHaveValue('Save bar fixture')
    await expect(bar).toHaveCount(0)
    expect(errors).toEqual([])
    expect(writes).toEqual([])
    await context.close()
  }
  process.stdout.write(
    'PASS: desktop/mobile Chinese sticky save bar and local reset; no backend writes, page errors or overflow\n'
  )
} finally {
  await browser.close()
}
