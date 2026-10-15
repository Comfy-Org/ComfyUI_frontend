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
      const path = '/src/components/cms/editor/CatalogEditorPage.vue'
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
        enabled: false,
        visibility: 'staff',
        visible_from: '2026-10-15T09:30:45.123-07:00',
        use_cases: ['Portraits, editorial'],
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
      window.document.body.append(root)
      createApp({
        render: () =>
          h(editor, {
            editor: {
              initial: document,
              snapshot,
              type: 'workflow',
              draft: 7,
              csrf: 'fixture-no-backend-access'
            },
            liveRevision: 6,
            locale
          })
      }).mount(root)
    }, fixture.locale)
    const title = page.getByRole('textbox', {
      name: fixture.title,
      exact: true
    })
    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.getByRole('region', { name: fixture.bar })).toHaveCount(0)
    const schedule = page.getByLabel(
      fixture.locale === 'en' ? 'Visible from (UTC)' : '可见时间（UTC）'
    )
    await expect(schedule).toHaveValue('2026-10-15T16:30:45')
    await schedule.fill('2026-11-01T15:16:17')
    await schedule.press('Tab')
    const useCases = page.getByRole('button', {
      name: fixture.locale === 'en' ? 'Use cases' : '用途',
      exact: true
    })
    await useCases.click()
    await page.getByRole('searchbox').fill('Product photography')
    await page.getByRole('searchbox').press('Enter')
    await page.getByRole('searchbox').press('Escape')
    await title.fill('Pending form edit')
    const bar = page.getByRole('region', { name: fixture.bar })
    await expect(bar).toBeVisible()
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    const bounds = await bar.boundingBox()
    expect(bounds).not.toBeNull()
    expect(
      Math.abs((bounds?.y ?? 0) + (bounds?.height ?? 0) - 900)
    ).toBeLessThanOrEqual(1)
    expect(bounds?.x).toBe(fixture.width >= 1024 ? 240 : 0)
    const live = page.getByRole('button', {
      name: fixture.locale === 'en' ? 'Open live site' : '打开正式网站'
    })
    if (fixture.width >= 1024) {
      await expect(live).toBeInViewport()
    }
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
    await expect(schedule).toHaveValue('2026-10-15T16:30:45')
    await expect(bar).toHaveCount(0)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({
      path: `/tmp/ccc-bruce-editor-top-${fixture.suffix}.png`
    })
    await page
      .getByRole('button', {
        name: fixture.locale === 'en' ? 'Delete content' : '删除内容',
        exact: true
      })
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.screenshot({
      path: `/tmp/ccc-bruce-editor-delete-${fixture.suffix}.png`
    })
    await dialog
      .getByRole('button', {
        name: fixture.locale === 'en' ? 'Cancel' : '取消',
        exact: true
      })
      .click()
    await expect(dialog).toHaveCount(0)
    expect(errors).toEqual([])
    expect(writes).toEqual([])
    await context.close()
  }
  process.stdout.write(
    'PASS: desktop/mobile Chinese editor/sidebar, UTC schedule, editorial chooser, sticky save bar/reset and delete confirmation/cancel; no backend writes, page errors or overflow\n'
  )
} finally {
  await browser.close()
}
